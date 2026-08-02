import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { listPublicArtists } from '@/lib/songs';
import { coverSitemapSrc } from '@/lib/coverUrl';
import { songPath } from '@/lib/slug';
import { absoluteUrl, SITE_URL } from '@/lib/site';

/**
 * Карта сайта.
 *
 * Собирается ИЗ БАЗЫ на каждой пересборке — руками сюда не добавляется ничего и
 * никогда. Опубликовали разбор — он попадёт в карту сам, в пределах часа
 * (`revalidate`); сняли с публикации или удалили — так же сам исчезнет, потому
 * что список каждый раз строится заново, а не дополняется.
 *
 * Час, а не минута: карту поисковик перечитывает несколько раз в сутки, и
 * пересобирать её чаще — значит гонять полный обход базы ради ответа, который
 * никто не спросит.
 */
export const revalidate = 3600;

/**
 * Потолок числа адресов. Стандарт разрешает 50 000 на файл, до этого сайту
 * далеко — но потолок должен быть явным, иначе в тот день, когда разборов
 * станет больше, карта молча начнёт отдавать невалидный XML, и об этом узнают
 * из панели вебмастера через неделю.
 *
 * Когда упрёмся: карту надо будет разрезать на несколько файлов и добавить
 * индексный (`<sitemapindex>`). Порядок здесь — «свежие сверху» именно поэтому:
 * при обрезке теряются самые старые, а не случайные.
 */
const MAX_URLS = 45000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const songs = await prisma.song.findMany({
    where: { visibility: 'public' },
    // Всё, из чего собирается адрес с подписью, плюс обложка для картиночной
    // выдачи. Сам base64 обложки НЕ выбираем (см. lib/songs.ts) — картинку
    // отдаёт отдельный маршрут, здесь нужна только ссылка на него.
    select: {
      id: true,
      title: true,
      artist: true,
      updatedAt: true,
      hasCover: true,
      userId: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_URLS,
  });

  const authorIds = [...new Set(songs.map((s) => s.userId))];
  const artists = await listPublicArtists();

  // Дата последней правки разделов — не «сейчас»: поисковик сверяет её со своей
  // прошлой выгрузкой и по неизменившейся дате пропускает страницу без запроса.
  // Проставлять текущее время значило бы каждый час звать его перечитать всё
  // подряд — и добиться того, что он перестанет верить этому полю вообще.
  const lastSongChange = songs[0]?.updatedAt ?? new Date();

  return [
    {
      url: SITE_URL,
      lastModified: lastSongChange,
      changeFrequency: 'daily',
      priority: 1,
    },
    // Каталог укулеле — отдельная точка входа со своими запросами.
    {
      url: `${SITE_URL}/ukulele`,
      lastModified: lastSongChange,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    ...songs.map((s) => ({
      url: absoluteUrl(songPath(s)),
      lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      // Обложка попадает в поиск по картинкам — оттуда приходят те, кто ищет
      // песню по альбому, а не по названию. Адрес строится особой функцией:
      // амперсанд в нём сломал бы весь файл (объяснение — там же).
      ...(s.hasCover ? { images: [absoluteUrl(coverSitemapSrc(s.id, s.updatedAt))] } : {}),
    })),
    // Страницы исполнителей — под запросы вида «<исполнитель> аккорды».
    ...artists.map((a) => ({
      url: absoluteUrl(`/artist/${encodeURIComponent(a)}`),
      lastModified: lastSongChange,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...authorIds.map((id) => ({
      url: absoluteUrl(`/u/${id}`),
      lastModified: lastSongChange,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
