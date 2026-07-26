import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Индексируем каталог, публичные разборы и профили авторов. Личные разделы
 * (кабинет, мои песни, редактор, вход) закрыты — там нет ничего для поиска,
 * а обход только тратит краулинговый бюджет.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/account',
          '/songs/new',
          '/songs/*/edit',
          '/login',
          '/register',
          '/demo',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
