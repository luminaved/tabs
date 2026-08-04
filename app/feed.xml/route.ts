import { prisma } from '@/lib/db';
import { getInstrument } from '@/lib/chords/instruments';
import { songSeoDescription, songSeoTitle } from '@/lib/seo';
import { songPath } from '@/lib/slug';
import { absoluteUrl, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
// Общий с картой сайта: оба файла машинные и оба ломаются от одного сырого
// амперсанда, поэтому правило экранирования должно быть ровно одно.
import { xmlEscape as xml } from '@/lib/xmlEscape';

/**
 * RSS свежих разборов.
 *
 * Зачем он сайту с аккордами: это второй, независимый от карты сайта канал, по
 * которому о новом разборе узнают в тот же день. Карту поисковик перечитывает
 * по своему расписанию, а лента — то, на что подписываются агрегаторы и читалки,
 * и оттуда же приходят первые внешние ссылки. Стоит она один запрос в час.
 *
 * Отдаётся маршрутом, а не файлом: содержимое целиком из базы, руками сюда, как
 * и в карту сайта, не добавляется ничего.
 */
export const revalidate = 3600;

/** Сколько разборов в ленте. Лента — про «что нового», а не про весь каталог. */
const LIMIT = 30;

export async function GET() {
  const songs = await prisma.song.findMany({
    where: { visibility: 'public' },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      instrument: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });

  const items = songs
    .map((song) => {
      const inst = getInstrument(song.instrument);
      const url = absoluteUrl(songPath(song));
      return [
        '    <item>',
        `      <title>${xml(songSeoTitle(song, inst))}</title>`,
        `      <link>${xml(url)}</link>`,
        // isPermaLink="false": ключом записи служит идентификатор разбора, а не
        // адрес. Адрес меняется вместе с названием (в нём подпись), и по нему
        // читалка сочла бы переименованный разбор новым.
        `      <guid isPermaLink="false">${xml(song.id)}</guid>`,
        `      <description>${xml(songSeoDescription(song, inst))}</description>`,
        `      <pubDate>${song.createdAt.toUTCString()}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xml(`${SITE_NAME} — новые разборы`)}</title>`,
    `    <link>${xml(SITE_URL)}</link>`,
    `    <description>${xml(`Свежие ${SITE_TAGLINE}`)}</description>`,
    '    <language>ru</language>',
    // Ссылка ленты на саму себя — этого требует валидатор RSS и по ней читалки
    // находят канонический адрес после переезда.
    `    <atom:link href="${xml(absoluteUrl('/feed.xml'))}" rel="self" type="application/rss+xml"/>`,
    ...(songs[0] ? [`    <lastBuildDate>${songs[0].createdAt.toUTCString()}</lastBuildDate>`] : []),
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${revalidate}, stale-while-revalidate=86400`,
    },
  });
}
