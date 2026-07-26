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
  const v = new Date(updatedAt).getTime().toString(36);
  return `/covers/${songId}?v=${v}&s=${size}`;
}
