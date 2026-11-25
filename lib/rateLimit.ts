/**
 * Счётчик попыток в фиксированном окне — для форм входа и регистрации.
 *
 * Зачем: проверка пароля стоит десятки миллисекунд CPU (bcrypt, см.
 * [password.ts](./password.ts)), и без ограничения любой желающий мог сколько
 * угодно долбить вход, занимая процессор и подбирая пароли. Регистрация без
 * ограничения — это ещё и бесконтрольное создание аккаунтов.
 *
 * Хранилищ два, и выбор происходит сам:
 *
 *   — **Общее (Upstash Redis по REST)** — если заданы `UPSTASH_REDIS_REST_URL`
 *     и `UPSTASH_REDIS_REST_TOKEN`. Именно оно делает лимит настоящим: на
 *     Vercel инстансов много, и у счётчика в памяти потолок молча умножался на
 *     их число. REST, а не клиент по TCP: не нужен ни пакет в зависимостях, ни
 *     живое соединение, которого у serverless всё равно нет.
 *
 *   — **Память процесса** — если переменных нет (разработка, свой сервер в
 *     одном экземпляре). Работает ровно как раньше.
 *
 * Если общее хранилище настроено, но не отвечает, запрос НЕ падает и никого не
 * запирает: попытка досчитывается в памяти. Это слабее общего счётчика, но
 * сильнее, чем «пропускать всё», и главное — недоступный Redis не превращается
 * в отказ входа для всех.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Через сколько секунд можно повторить. Осмысленно только при `ok: false`. */
  retryAfter: number;
}

// ─── Хранилище в памяти процесса ───────────────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Потолок числа окон в памяти: ключ включает адрес, а их бесконечно много.
// При переполнении выбрасываем самые старые — это счётчик, а не бухгалтерия.
const MAX_BUCKETS = 10_000;

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

function memoryRetryAfter(key: string, limit: number): number {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now || bucket.count <= limit) return 0;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

/**
 * Чистка протухших окон. Отдельного таймера нет намеренно: он держал бы процесс
 * живым и в serverless-окружении только мешал. Если протухших не набралось —
 * выбрасываем самые старые по времени сброса.
 */
function evictExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size < MAX_BUCKETS) return;

  const byAge = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  for (const [key] of byAge.slice(0, Math.ceil(MAX_BUCKETS / 4))) buckets.delete(key);
}

// ─── Общее хранилище (Upstash Redis, REST) ─────────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Настроено ли общее хранилище. Экспортируется для диагностики и тестов. */
export const sharedStoreEnabled = !!(REDIS_URL && REDIS_TOKEN);

/** Ключи в общем хранилище с префиксом — база может быть не только нашей. */
const NS = 'rl:';

/** Дольше ждать нечего: лимит не должен задерживать вход больше самого входа. */
const REDIS_TIMEOUT_MS = 1500;

/**
 * Пачка команд одним запросом. Возвращает результаты по порядку либо null,
 * если хранилище недоступно, — вызывающий код тогда уходит в память.
 */
async function pipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  if (!sharedStoreEnabled) return null;
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(rows) || rows.some((r) => r?.error)) return null;
    return rows.map((r) => r.result);
  } catch {
    // Недоступен, оборвался, не уложился в таймаут.
    return null;
  }
}

function toInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

// ─── Публичный интерфейс ───────────────────────────────────────────────────

/**
 * Отмечает попытку. `ok: false` — лимит исчерпан, запрос обслуживать не нужно.
 * Окно фиксированное: первая попытка заводит его, `limit`+1-я в пределах окна
 * уже отбивается.
 */
export async function hit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // INCR заводит ключ со значением 1, если его не было, поэтому счёт и создание
  // окна — одна операция без гонки. PTTL тем же запросом сообщает, сколько окну
  // осталось жить: отдельный round-trip ради этого не нужен.
  const rows = await pipeline([
    ['INCR', NS + key],
    ['PTTL', NS + key],
  ]);
  if (!rows) return memoryHit(key, limit, windowMs);

  const count = toInt(rows[0]);
  let ttl = toInt(rows[1]);

  // Срок ставим первой попытке. Отрицательный PTTL (-1 «без срока») означает,
  // что EXPIRE потерялся — тогда чиним, иначе ключ остался бы навсегда и
  // запер бы адрес насовсем.
  if (count === 1 || ttl < 0) {
    await pipeline([['PEXPIRE', NS + key, windowMs]]);
    ttl = windowMs;
  }

  if (count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Сколько секунд осталось ждать, если лимит по ключу уже исчерпан (иначе 0).
 * В отличие от `hit`, попытку НЕ засчитывает.
 *
 * Нужен форме входа: сам счётчик крутится в `authorize` (см. lib/auth.ts) —
 * это единственное место, через которое проходят оба пути входа. Форме остаётся
 * лишь объяснить отказ человеческим текстом вместо «неверный email или пароль»,
 * и ради этого объяснения крутить счётчик второй раз не нужно.
 */
export async function retryAfter(key: string, limit: number): Promise<number> {
  const rows = await pipeline([
    ['GET', NS + key],
    ['PTTL', NS + key],
  ]);
  if (!rows) return memoryRetryAfter(key, limit);

  // Ключа нет — GET вернёт null, счёт нулевой, ждать нечего.
  if (rows[0] === null || rows[0] === undefined) return 0;

  const count = toInt(rows[0]);
  const ttl = toInt(rows[1]);
  if (count <= limit || ttl <= 0) return 0;
  return Math.max(1, Math.ceil(ttl / 1000));
}

/**
 * Снимает счётчик. Нужен после удачного входа: лимит заведён против перебора, а
 * человек, знающий пароль, — не перебор. Без сброса за одним внешним адресом
 * (офис, мобильный оператор, NAT) десяток обычных входов подряд закрывал бы
 * форму всем остальным.
 */
export async function clear(key: string): Promise<void> {
  // Чистим в обоих хранилищах: попытки могли попасть в память, пока общее
  // было недоступно.
  buckets.delete(key);
  await pipeline([['DEL', NS + key]]);
}

/** Только для тестов: сбрасывает состояние между случаями. */
export function resetRateLimits() {
  buckets.clear();
}
