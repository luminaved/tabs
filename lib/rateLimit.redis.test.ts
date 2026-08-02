import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Общее хранилище лимита (Upstash по REST).
 *
 * Модуль читает переменные окружения на загрузке, поэтому каждый случай
 * поднимает его заново через resetModules с подменённым fetch — так проверяется
 * ровно то, что уходит по сети, и как разбирается ответ.
 */

type Rows = { result?: unknown; error?: string }[];

async function withRedis(reply: (commands: string[][]) => Rows | Error) {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');

  const sent: string[][][] = [];
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const commands = JSON.parse(init.body) as string[][];
    sent.push(commands);
    const out = reply(commands);
    if (out instanceof Error) throw out;
    return { ok: true, json: async () => out } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);

  const mod = await import('./rateLimit');
  return { mod, sent };
}

/** Все команды одного вида из всех отправленных пачек. */
const commandsNamed = (sent: string[][][], name: string) =>
  sent.flat().filter((c) => c[0] === name);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('общее хранилище', () => {
  it('включается наличием переменных', async () => {
    const { mod } = await withRedis(() => [{ result: 1 }, { result: -1 }]);
    expect(mod.sharedStoreEnabled).toBe(true);
  });

  it('первая попытка считает и ставит срок окну', async () => {
    const { mod, sent } = await withRedis((cmds) =>
      cmds[0][0] === 'INCR' ? [{ result: 1 }, { result: -1 }] : [{ result: 1 }],
    );

    const res = await mod.hit('login:1.2.3.4', 10, 60_000);
    expect(res.ok).toBe(true);

    // Ключ уходит с префиксом пространства имён.
    expect(commandsNamed(sent, 'INCR')[0]).toEqual(['INCR', 'rl:login:1.2.3.4']);
    // Срок ставится именно первой попытке — иначе ключ остался бы навсегда.
    expect(commandsNamed(sent, 'PEXPIRE')[0]).toEqual(['PEXPIRE', 'rl:login:1.2.3.4', 60_000]);
  });

  it('последующие попытки срок не переставляют — окно фиксированное', async () => {
    const { mod, sent } = await withRedis(() => [{ result: 3 }, { result: 42_000 }]);
    await mod.hit('k', 10, 60_000);
    expect(commandsNamed(sent, 'PEXPIRE')).toHaveLength(0);
  });

  it('за лимитом — отказ, ждать столько, сколько осталось окну', async () => {
    const { mod } = await withRedis(() => [{ result: 11 }, { result: 30_500 }]);
    const res = await mod.hit('k', 10, 60_000);
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBe(31);
  });

  it('потерянный срок восстанавливается', async () => {
    // PTTL = -1 значит «ключ без срока»: без починки адрес заперло бы навсегда.
    const { mod, sent } = await withRedis((cmds) =>
      cmds[0][0] === 'INCR' ? [{ result: 5 }, { result: -1 }] : [{ result: 1 }],
    );
    await mod.hit('k', 10, 60_000);
    expect(commandsNamed(sent, 'PEXPIRE')).toHaveLength(1);
  });

  it('retryAfter не считает попыток', async () => {
    const { mod, sent } = await withRedis(() => [{ result: '11' }, { result: 20_000 }]);
    const wait = await mod.retryAfter('k', 10);
    expect(wait).toBe(20);
    // Ключевое: INCR быть не должно, иначе форма входа съедала бы лимит вдвое.
    expect(commandsNamed(sent, 'INCR')).toHaveLength(0);
    expect(commandsNamed(sent, 'GET')).toHaveLength(1);
  });

  it('нет ключа — ждать нечего', async () => {
    const { mod } = await withRedis(() => [{ result: null }, { result: -2 }]);
    expect(await mod.retryAfter('k', 10)).toBe(0);
  });

  it('clear удаляет ключ', async () => {
    const { mod, sent } = await withRedis(() => [{ result: 1 }]);
    await mod.clear('k');
    expect(commandsNamed(sent, 'DEL')[0]).toEqual(['DEL', 'rl:k']);
  });
});

describe('когда общее хранилище недоступно', () => {
  /**
   * Главное свойство: упавший Redis не должен ни запирать вход всем подряд,
   * ни отключать лимит совсем. Обе крайности одинаково плохи, поэтому счёт
   * молча уходит в память процесса.
   */
  it('сеть оборвалась — считаем в памяти и лимит продолжает работать', async () => {
    const { mod } = await withRedis(() => new Error('ECONNRESET'));

    for (let i = 0; i < 3; i++) {
      expect((await mod.hit('k', 3, 60_000)).ok).toBe(true);
    }
    const over = await mod.hit('k', 3, 60_000);
    expect(over.ok).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it('хранилище ответило ошибкой — тоже память', async () => {
    const { mod } = await withRedis(() => [{ error: 'WRONGTYPE' }, { result: 0 }]);
    expect((await mod.hit('k', 1, 60_000)).ok).toBe(true);
    expect((await mod.hit('k', 1, 60_000)).ok).toBe(false);
  });

  it('retryAfter в этом случае тоже отвечает по памяти', async () => {
    const { mod } = await withRedis(() => new Error('down'));
    for (let i = 0; i < 2; i++) await mod.hit('k', 1, 60_000);
    expect(await mod.retryAfter('k', 1)).toBeGreaterThan(0);
  });
});
