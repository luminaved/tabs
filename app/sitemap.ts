import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { listPublicArtists } from '@/lib/songs';
import { SITE_URL } from '@/lib/site';

// Карта сайта пересобирается раз в час: разборы добавляют не поминутно.
export const revalidate = 3600;

/** Карта сайта: каталог + публичные разборы + профили авторов с ними. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const songs = await prisma.song.findMany({
    where: { visibility: 'public' },
    select: { id: true, updatedAt: true, userId: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  });

  const authorIds = [...new Set(songs.map((s) => s.userId))];
  const artists = await listPublicArtists();

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    // Каталог укулеле — отдельная точка входа со своими запросами.
    {
      url: `${SITE_URL}/ukulele`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    ...songs.map((s) => ({
      url: `${SITE_URL}/songs/${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // Страницы исполнителей — под запросы вида «<исполнитель> аккорды».
    ...artists.map((a) => ({
      url: `${SITE_URL}/artist/${encodeURIComponent(a)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...authorIds.map((id) => ({
      url: `${SITE_URL}/u/${id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
