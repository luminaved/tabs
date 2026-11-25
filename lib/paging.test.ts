import { describe, expect, it } from 'vitest';
import { SONGS_PAGE_SIZE, pageSkip, pageTake, parsePage, splitPage } from './paging';

describe('parsePage', () => {
  it('обычные значения', () => {
    expect(parsePage(0)).toBe(0);
    expect(parsePage(3)).toBe(3);
    expect(parsePage('2')).toBe(2);
  });

  it('мусор и отсутствие значения — первая страница', () => {
    expect(parsePage(undefined)).toBe(0);
    expect(parsePage(null)).toBe(0);
    expect(parsePage('')).toBe(0);
    expect(parsePage('abc')).toBe(0);
    expect(parsePage(NaN)).toBe(0);
    // Бесконечность — тоже мусор: безопаснее показать первую страницу, чем
    // молча увести человека на потолок нумерации.
    expect(parsePage(Infinity)).toBe(0);
    expect(parsePage(-Infinity)).toBe(0);
  });

  it('отрицательные подтягиваются к нулю', () => {
    expect(parsePage(-1)).toBe(0);
    expect(parsePage('-40')).toBe(0);
  });

  it('дробные обрезаются к целому', () => {
    expect(parsePage(2.9)).toBe(2);
  });

  // Большой OFFSET заставляет БД пройти и выбросить все предыдущие строки,
  // поэтому номер страницы ограничен сверху.
  it('номер страницы ограничен сверху', () => {
    expect(parsePage(10_000)).toBe(200);
    expect(parsePage(10_000, 5)).toBe(5);
  });
});

describe('pageSkip / pageTake', () => {
  it('пропуск считается от размера страницы', () => {
    expect(pageSkip(0)).toBe(0);
    expect(pageSkip(1)).toBe(SONGS_PAGE_SIZE);
    expect(pageSkip(3)).toBe(SONGS_PAGE_SIZE * 3);
  });

  it('мусорный номер не ломает пропуск', () => {
    expect(pageSkip(-5)).toBe(0);
  });

  it('запрашиваем на одну строку больше — это и есть признак продолжения', () => {
    expect(pageTake()).toBe(SONGS_PAGE_SIZE + 1);
    expect(pageTake(10)).toBe(11);
  });
});

describe('splitPage', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('лишняя строка означает продолжение и в выдачу не попадает', () => {
    const { page, hasMore } = splitPage(rows(11), 10);
    expect(page).toHaveLength(10);
    expect(page.at(-1)).toBe(9);
    expect(hasMore).toBe(true);
  });

  it('ровно страница — продолжения нет', () => {
    const { page, hasMore } = splitPage(rows(10), 10);
    expect(page).toHaveLength(10);
    expect(hasMore).toBe(false);
  });

  it('неполная страница и пустая выборка', () => {
    expect(splitPage(rows(3), 10)).toEqual({ page: [0, 1, 2], hasMore: false });
    expect(splitPage(rows(0), 10)).toEqual({ page: [], hasMore: false });
  });
});
