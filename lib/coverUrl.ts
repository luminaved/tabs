/**
 * Ссылка на обложку песни. Версионируется по updatedAt, чтобы браузер сбросил
 * кэш при смене картинки (сам маршрут отдаёт её с длинным max-age).
 *
 * `size`: 'sm' — миниатюра в списках, 'md' — обложка на странице разбора.
 * Маршрут пережимает картинку под этот размер, поэтому в списки уходят
 * килобайты вместо десятков килобайт.
 */
export function coverSrc(
  songId: string,
  updatedAt: Date | string | number,
  size: 'sm' | 'md' = 'md',
): string {
  return `/covers/${songId}?v=${coverVersion(updatedAt)}&s=${size}`;
}

/**
 * Ссылка на обложку для карты сайта — с версией, но БЕЗ размера.
 *
 * Размер опущен не для краткости: маршрут без `?s=` и так отдаёт 'md', а вот
 * второй параметр принёс бы в адрес амперсанд. Next выводит карту сайта
 * подстановкой строк, без экранирования XML (см. resolve-route-data в его
 * исходниках), и сырой `&` внутри <image:loc> делает весь файл невалидным —
 * поисковик отбрасывает его целиком, а не одну строчку.
 */
export function coverSitemapSrc(songId: string, updatedAt: Date | string | number): string {
  return `/covers/${songId}?v=${coverVersion(updatedAt)}`;
}

/**
 * Версия обложки. Считается и здесь (для ссылки), и в самом маршруте (для ключа
 * кэша) — маршрут берёт `updatedAt` из базы, а не из query-параметра: значение
 * из адреса задаёт клиент, и как ключ кэша оно пускало любого желающего
 * плодить записи произвольными `?v=`.
 */
export function coverVersion(updatedAt: Date | string | number): string {
  return new Date(updatedAt).getTime().toString(36);
}
