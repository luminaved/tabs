/**
 * Русское склонение существительного при числительном.
 *
 * Правило одно на весь проект: до этого оно было выписано трижды (черновики,
 * подпись числа струн, счётчик разборов у исполнителя), и на странице
 * исполнителя копия была неверной — там форма выбиралась по `n < 5`, из-за чего
 * получалось «21 разборов» вместо «21 разбор» и «22 разборов» вместо «22
 * разбора». Развилка идёт по последней цифре, но десятки 11–14 — исключение:
 * они всегда берут форму множественного числа.
 */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «1 разбор» / «2 разбора» / «5 разборов» — число вместе с формой слова. */
export function withPluralRu(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  return `${n} ${pluralRu(n, one, few, many)}`;
}
