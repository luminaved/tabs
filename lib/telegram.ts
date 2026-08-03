import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Проверка данных от Telegram Login Widget.
 *
 * Виджет возвращает поля профиля прямо в браузер, то есть в руки тому, кто
 * входит. Единственное, что отличает настоящий ответ Telegram от выдуманного, —
 * подпись `hash`, поэтому этот модуль и есть вся защита входа: ошибись здесь —
 * и любой сможет войти под любым Telegram-идентификатором, просто отправив
 * форму руками.
 *
 * Схема подписи описана в https://core.telegram.org/widgets/login:
 *   ключ    = SHA256(токен бота)          — двоичный, НЕ hex;
 *   строка  = все поля кроме `hash`, «ключ=значение», отсортированы по имени,
 *             склеены переводом строки;
 *   подпись = HMAC_SHA256(строка, ключ) в hex.
 */

/** Максимальный возраст подписи. Против повторной отправки перехваченных данных. */
export const TELEGRAM_MAX_AGE_SEC = 24 * 60 * 60;

export interface TelegramProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

/**
 * Строка для подписи: все поля, кроме `hash`, отсортированные по имени.
 *
 * Сортировка обязательна и обязана быть по КОДАМ символов, а не по локали:
 * Telegram собирает строку так же, и любое расхождение в порядке даёт другую
 * подпись. Пустые и отсутствующие поля пропускаются — их нет и у Telegram.
 */
export function telegramCheckString(data: Record<string, string | undefined>): string {
  return Object.keys(data)
    .filter((k) => k !== 'hash' && data[k] !== undefined && data[k] !== '')
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
}

export type TelegramCheck =
  | { ok: true; profile: TelegramProfile }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

/**
 * Проверяет подпись и свежесть. Возвращает разобранный профиль либо причину
 * отказа — причина нужна логам, наружу её показывать не следует.
 *
 * Сравнение подписей — `timingSafeEqual`, а не `===`: обычное сравнение строк
 * выходит на первом различающемся байте, и по времени ответа подпись можно
 * подобрать побайтово. Длины сверяем заранее, потому что `timingSafeEqual`
 * на разных длинах бросает.
 */
export function verifyTelegramAuth(
  raw: Record<string, string | undefined>,
  botToken: string,
  now: Date = new Date(),
): TelegramCheck {
  const id = raw.id?.trim();
  const authDate = raw.auth_date?.trim();
  const hash = raw.hash?.trim();

  // `id` и `auth_date` обязаны быть числами: они уходят в БД и в проверку
  // возраста, а строка вроде «12e5» или «0x10» дала бы сюрприз в обоих местах.
  if (!id || !/^\d+$/.test(id)) return { ok: false, reason: 'malformed' };
  if (!authDate || !/^\d+$/.test(authDate)) return { ok: false, reason: 'malformed' };
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'malformed' };
  if (!botToken) return { ok: false, reason: 'malformed' };

  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret)
    .update(telegramCheckString(raw))
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash.toLowerCase(), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' };
  }

  // Возраст проверяем ПОСЛЕ подписи: до неё значение подконтрольно отправителю
  // и решать по нему нечего.
  const ageSec = Math.floor(now.getTime() / 1000) - Number(authDate);
  // Отрицательный возраст — часы разъехались или дату подкрутили; за пределами
  // небольшого допуска считаем такое просроченным.
  if (ageSec > TELEGRAM_MAX_AGE_SEC || ageSec < -300) {
    return { ok: false, reason: 'expired' };
  }

  return {
    ok: true,
    profile: {
      id,
      first_name: raw.first_name,
      last_name: raw.last_name,
      username: raw.username,
      photo_url: raw.photo_url,
      auth_date: authDate,
      hash,
    },
  };
}

/** Отображаемое имя: то, что человек ожидает увидеть в шапке. */
export function telegramDisplayName(p: TelegramProfile): string | null {
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return full || p.username || null;
}
