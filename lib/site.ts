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

export const SITE_NAME = 'tabs';
export const SITE_TAGLINE = 'аккорды и разборы песен на гитаре';

/** Абсолютный URL из пути (`/songs/x` → `https://site/songs/x`). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
