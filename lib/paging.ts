/**
 * Постраничная выдача списков песен.
 *
 * Модуль намеренно ни от чего не зависит: им пользуются и каталог
 * ([songs.ts](./songs.ts)), и списки карточек ([engagement.ts](./engagement.ts)),
 * а те друг друга не импортируют — общая константа в любом из них завела бы
 * циклическую зависимость.
 */

/** Сколько строк отдаём за раз. Одинаково во всех списках песен. */
export const SONGS_PAGE_SIZE = 5;

/**
 * Потолок номера страницы. Без него запросом можно было бы заставить БД
 * листать выдачу сколь угодно далеко: большой OFFSET заставляет её пройти и
 * выбросить все предыдущие строки.
 */
const MAX_PAGE = 200;

/** Номер страницы (с нуля) из query-параметра или аргумента экшена. */
export function parsePage(value: unknown, max: number = MAX_PAGE): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(0, Math.trunc(n)), max);
}

/** Сколько строк пропустить, чтобы получить страницу `page`. */
export function pageSkip(page: number, size: number = SONGS_PAGE_SIZE): number {
  return parsePage(page) * size;
}

/**
 * Сколько строк запросить у БД: на одну больше страницы. Лишняя строка — это и
 * есть ответ на вопрос «есть ли продолжение», и он обходится без отдельного
 * COUNT по всей выборке.
 */
export function pageTake(size: number = SONGS_PAGE_SIZE): number {
  return size + 1;
}

/** Режет выборку «на одну строку больше» на саму страницу и признак продолжения. */
export function splitPage<T>(
  rows: T[],
  size: number = SONGS_PAGE_SIZE,
): { page: T[]; hasMore: boolean } {
  return { page: rows.slice(0, size), hasMore: rows.length > size };
}
