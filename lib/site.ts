/**
 * Публичный адрес сайта — нужен для canonical, sitemap и абсолютных ссылок на
 * картинки превью (мессенджеры и поисковики относительные не понимают).
 *
 * Задаётся NEXT_PUBLIC_SITE_URL; на Vercel подхватывается автоматически.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

/**
 * Имя бренда. Живёт ровно здесь: заголовок вкладки, og:site_name,
 * applicationName, структурированные данные и картинка превью берут его
 * отсюда, чтобы переименование не пришлось ловить по файлам.
 *
 * Страницы НЕ дописывают бренд в свой `title` — его добавляет шаблон в
 * корневом layout (`%s | RawChords`). Иначе выходило «Демо — tabs | tabs».
 */
export const SITE_NAME = 'RawChords';
export const SITE_TAGLINE = 'аккорды и разборы песен на гитаре';

/** Заголовок главной и значение по умолчанию для страниц без своего. */
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/** Абсолютный URL из пути (`/songs/x` → `https://site/songs/x`). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
