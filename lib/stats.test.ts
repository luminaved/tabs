import { describe, expect, it } from 'vitest';
import { TREND_DAYS, fillDays, trendStart } from './stats';

const DAY = 24 * 60 * 60 * 1000;

/** Полдень UTC — чтобы «время суток» в дате было заведомо не нулевым. */
const NOW = Date.UTC(2026, 7, 4, 12, 34, 56); // 2026-08-04

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

describe('trendStart', () => {
  it('возвращает ПОЛНОЧЬ UTC, а не текущее время суток', () => {
    const start = trendStart(30, NOW);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });

  it('отсчитывает days−1 суток назад: ряд из N точек кончается сегодня', () => {
    expect(ymd(trendStart(30, NOW).getTime())).toBe('2026-07-06'); // 4 авг − 29 дней
    expect(ymd(trendStart(1, NOW).getTime())).toBe('2026-08-04');
  });
});

describe('fillDays', () => {
  it('ряд длиной ровно в запрошенное число дней', () => {
    expect(fillDays([], 30, NOW)).toHaveLength(30);
    expect(fillDays([], 7, NOW)).toHaveLength(7);
  });

  it('дни идут подряд и заканчиваются сегодняшним', () => {
    const points = fillDays([], TREND_DAYS, NOW);
    expect(points[0].day).toBe('2026-07-06');
    expect(points[points.length - 1].day).toBe('2026-08-04');
    for (let i = 1; i < points.length; i++) {
      const prev = Date.parse(`${points[i - 1].day}T00:00:00Z`);
      expect(points[i].day).toBe(ymd(prev + DAY));
    }
  });

  it('дни без событий становятся нулями, а не пропадают', () => {
    const points = fillDays([{ day: '2026-08-04', n: 5 }], 30, NOW);
    expect(points[points.length - 1]).toEqual({ day: '2026-08-04', value: 5 });
    expect(points[0]).toEqual({ day: '2026-07-06', value: 0 });
  });

  it('НИ ОДНА строка из окна запроса не теряется по дороге', () => {
    // Ровно тот баг: запрос отбирал от `now − 30 дней`, а ряд строился с
    // `now − 29`, и самый старый день молча выбрасывался. Здесь на каждый день
    // окна кладём единицу и проверяем, что сумма ряда совпадает с числом строк.
    const start = trendStart(TREND_DAYS, NOW).getTime();
    const rows = Array.from({ length: TREND_DAYS }, (_, i) => ({
      day: ymd(start + i * DAY),
      n: 1,
    }));
    const points = fillDays(rows, TREND_DAYS, NOW);
    expect(points.reduce((a, p) => a + p.value, 0)).toBe(rows.length);
  });

  it('граница окна запроса совпадает с первой точкой ряда', () => {
    // Именно это равенство и держит инвариант выше: `getAdminStats` отбирает
    // строки от `trendStart(TREND_DAYS)`, а ряд с него же и начинается.
    const points = fillDays([], TREND_DAYS, NOW);
    expect(points[0].day).toBe(ymd(trendStart(TREND_DAYS, NOW).getTime()));
  });

  it('значения приводятся к числу (Postgres может отдать строку)', () => {
    const rows = [{ day: '2026-08-04', n: '7' as unknown as number }];
    expect(fillDays(rows, 30, NOW)[29].value).toBe(7);
  });

  it('чужие дни за пределами окна в ряд не попадают', () => {
    const points = fillDays([{ day: '2020-01-01', n: 99 }], 30, NOW);
    expect(points.some((p) => p.value !== 0)).toBe(false);
  });
});
