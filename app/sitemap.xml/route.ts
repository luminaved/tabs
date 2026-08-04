import { prisma } from '@/lib/db';
import { listPublicArtists } from '@/lib/songs';
import { coverSitemapSrc } from '@/lib/coverUrl';
import { songPath } from '@/lib/slug';
import { absoluteUrl } from '@/lib/site';
import { xmlEscape } from '@/lib/xmlEscape';

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
 *
 * ── Почему маршрут, а не `app/sitemap.ts` ───────────────────────────────────
 *
 * Раньше карта отдавалась через `MetadataRoute.Sitemap` — удобно, но порядок
 * элементов внутри `<url>` задаёт Next, а он ставит `<image:image>` СРАЗУ ПОСЛЕ
 * `<loc>`, перед `<lastmod>`. Схема sitemap.org этого не разрешает: `tUrl` —
 * это `xsd:sequence` из loc, lastmod, changefreq, priority, и только потом
 * `xsd:any` для расширений, причём с `processContents="strict"`.
 *
 * То есть файл остаётся валидным XML (браузер и любой обычный парсер разберут
 * его без замечаний), но невалиден КАК КАРТА САЙТА — и Search Console
 * отбрасывает его целиком: «не удалось обработать», ноль найденных страниц.
 * Поймать это глазами почти невозможно, потому что все привычные проверки
 * файл проходят.
 *
 * Своя сборка отдаёт порядок нам. Плата — экранирование теперь наша забота
 * (см. `xmlEscape`): Next подставлял строки без него, из-за чего ссылка на
 * обложку до сих пор собирается без второго параметра (см. `coverSitemapSrc`).
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

interface Entry {
  loc: string;
  lastmod: Date;
  changefreq: 'daily' | 'weekly';
  priority: string;
  /** Обложка для картиночной выдачи. Только у разборов, и только если есть. */
  image?: string;
}

/**
 * Одна запись карты. Порядок строк здесь — не вкусовщина, а требование схемы
 * (разбор — в шапке файла): loc, lastmod, changefreq, priority и только потом
 * расширения вроде `<image:image>`.
 */
function urlEntry(e: Entry): string {
  return [
    '<url>',
    `<loc>${xmlEscape(e.loc)}</loc>`,
    `<lastmod>${e.lastmod.toISOString()}</lastmod>`,
    `<changefreq>${e.changefreq}</changefreq>`,
    `<priority>${e.priority}</priority>`,
    ...(e.image
      ? ['<image:image>', `<image:loc>${xmlEscape(e.image)}</image:loc>`, '</image:image>']
      : []),
    '</url>',
  ].join('\n');
}

export async function GET() {
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

  const entries: Entry[] = [
    // Со слэшем: голый origin без пути формально адрес, но канонический адрес
    // главной у сайта именно со слэшем, и карта не должна с ним расходиться.
    { loc: absoluteUrl('/'), lastmod: lastSongChange, changefreq: 'daily', priority: '1.0' },
    // Каталог укулеле — отдельная точка входа со своими запросами.
    { loc: absoluteUrl('/ukulele'), lastmod: lastSongChange, changefreq: 'daily', priority: '0.9' },
    ...songs.map(
      (s): Entry => ({
        loc: absoluteUrl(songPath(s)),
        lastmod: s.updatedAt,
        changefreq: 'weekly',
        priority: '0.8',
        // Обложка попадает в поиск по картинкам — оттуда приходят те, кто ищет
        // песню по альбому, а не по названию.
        ...(s.hasCover ? { image: absoluteUrl(coverSitemapSrc(s.id, s.updatedAt)) } : {}),
      }),
    ),
    // Страницы исполнителей — под запросы вида «<исполнитель> аккорды».
    ...artists.map(
      (a): Entry => ({
        loc: absoluteUrl(`/artist/${encodeURIComponent(a)}`),
        lastmod: lastSongChange,
        changefreq: 'weekly',
        priority: '0.6',
      }),
    ),
    ...authorIds.map(
      (id): Entry => ({
        loc: absoluteUrl(`/u/${id}`),
        lastmod: lastSongChange,
        changefreq: 'weekly',
        priority: '0.4',
      }),
    ),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map(urlEntry),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${revalidate}, stale-while-revalidate=86400`,
    },
  });
}
