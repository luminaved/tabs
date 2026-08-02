import { afterEach, describe, expect, it, vi } from 'vitest';
import { clear, hit, resetRateLimits, retryAfter } from './rateLimit';

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe('hit', () => {
  it('пропускает попытки до лимита включительно', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await hit('a', 3, 1000)).ok).toBe(true);
    }
  });

  it('следующая за лимитом — отбивается', async () => {
    for (let i = 0; i < 3; i++) await hit('a', 3, 1000);
    const res = await hit('a', 3, 1000);
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThan(0);
  });

  it('ключи не мешают друг другу', async () => {
    for (let i = 0; i < 3; i++) await hit('a', 3, 1000);
    expect((await hit('a', 3, 1000)).ok).toBe(false);
    expect((await hit('b', 3, 1000)).ok).toBe(true);
  });

  it('после окна счётчик обнуляется', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) await hit('a', 3, 1000);
    expect((await hit('a', 3, 1000)).ok).toBe(false);

    vi.advanceTimersByTime(1001);
    expect((await hit('a', 3, 1000)).ok).toBe(true);
  });

  it('clear снимает счётчик — удачный вход не съедает лимит', async () => {
    for (let i = 0; i < 3; i++) await hit('a', 3, 60_000);
    expect((await hit('a', 3, 60_000)).ok).toBe(false);

    await clear('a');
    for (let i = 0; i < 3; i++) {
      expect((await hit('a', 3, 60_000)).ok).toBe(true);
    }
  });

  it('clear по чужому ключу ничего не трогает', async () => {
    for (let i = 0; i < 3; i++) await hit('a', 3, 60_000);
    await clear('b');
    expect((await hit('a', 3, 60_000)).ok).toBe(false);
  });

  it('retryAfter не превышает окна и не бывает нулевым', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 2; i++) await hit('a', 2, 60_000);
    const res = await hit('a', 2, 60_000);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
    expect(res.retryAfter).toBeLessThanOrEqual(60);
  });
});

describe('retryAfter', () => {
  it('пока лимит не исчерпан — ноль', async () => {
    expect(await retryAfter('a', 3)).toBe(0);
    for (let i = 0; i < 3; i++) await hit('a', 3, 60_000);
    expect(await retryAfter('a', 3)).toBe(0);
  });

  it('после исчерпания — сколько ждать', async () => {
    for (let i = 0; i < 4; i++) await hit('a', 3, 60_000);
    expect(await retryAfter('a', 3)).toBeGreaterThan(0);
  });

  // Главное свойство: форма входа зовёт retryAfter на КАЖДУЮ неудачную попытку,
  // и если бы он считал попытки, лимит выбирался бы вдвое быстрее заявленного.
  it('сам попыток не считает', async () => {
    for (let i = 0; i < 3; i++) {
      await hit('a', 3, 60_000);
      await retryAfter('a', 3);
    }
    expect(await retryAfter('a', 3)).toBe(0);
    expect((await hit('a', 3, 60_000)).ok).toBe(false);
  });

  it('после окна снова ноль', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i++) await hit('a', 3, 1000);
    expect(await retryAfter('a', 3)).toBeGreaterThan(0);

    vi.advanceTimersByTime(1001);
    expect(await retryAfter('a', 3)).toBe(0);
  });

  it('clear убирает и ожидание', async () => {
    for (let i = 0; i < 4; i++) await hit('a', 3, 60_000);
    await clear('a');
    expect(await retryAfter('a', 3)).toBe(0);
  });
});
