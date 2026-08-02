import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findArtistName, getArtistSummary, listSongsByArtist } from '@/lib/songs';
import { INSTRUMENTS, type InstrumentId } from '@/lib/chords/instruments';
import { withPluralRu } from '@/lib/plural';
import { songMeta } from '@/lib/songMeta';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { breadcrumbJsonLd, itemListJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { songPath } from '@/lib/slug';
import { catalogPath } from '@/lib/chords/instruments';
import { SongRow } from '@/components/SongRow';
import { LoadMoreSongs } from '@/components/LoadMoreSongs';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { loadMoreArtistSongsAction } from './actions';

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * «гитаре» / «укулеле» / «гитаре и укулеле».
 *
 * Список инструментов берётся из сводки по ВСЕМ разборам исполнителя
 * (`getArtistSummary`), а не из загруженной страницы: после разбивки на
 * страницы укулеле, оказавшееся во второй порции, пропало бы из заголовка.
 */
function onNames(ids: InstrumentId[]): string {
  const names = (ids.length ? ids : ['guitar' as InstrumentId]).map((id) => INSTRUMENTS[id].onName);
  return names.join(' и ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeName(name);
  // Обе функции обёрнуты в cache(): страница спросит то же самое без повторного
  // запроса к БД.
  const [artist, summary] = await Promise.all([
    findArtistName(decoded),
    getArtistSummary(decoded),
  ]);
  if (!artist) notFound();

  const on = onNames(summary.instruments);
  const title = `${artist} — аккорды и разборы всех песен на ${on}`;
  // Имя стоит ОТДЕЛЬНО, а не внутри фразы: по-русски его пришлось бы склонять
  // («все песни Кишлака»), а имена исполнителей склонению не поддаются —
  // половина из них латиницей или вовсе не существительные.
  const description =
    `${artist} — все песни с аккордами: ` +
    `${withPluralRu(summary.total, 'разбор', 'разбора', 'разборов')} на ${on} ` +
    'с текстом над словами, аппликатурами и транспонированием в любую тональность.';

  return {
    title,
    description,
    alternates: { canonical: `/artist/${encodeURIComponent(artist)}` },
    openGraph: {
      type: 'website',
      url: `/artist/${encodeURIComponent(artist)}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title,
      description,
    },
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeName(name);
  const [artist, summary, { songs, hasMore }] = await Promise.all([
    findArtistName(decoded),
    getArtistSummary(decoded),
    listSongsByArtist(decoded),
  ]);
  if (!artist) notFound();

  const path = `/artist/${encodeURIComponent(artist)}`;
  // Первый инструмент из сводки — тот каталог, к которому исполнитель ближе
  // всего. Крошка ведёт вверх по разделу, а не на главную «просто потому что».
  const crumbs: Crumb[] = [
    { name: 'Каталог', path: catalogPath(summary.instruments[0] ?? 'guitar') },
    { name: artist, path },
  ];

  /**
   * Исполнитель как сущность плюс перечень его разборов. `MusicGroup` — то, чем
   * страница является на самом деле; отдельным блоком идёт список, потому что
   * одна разметка отвечает на вопрос «про кого страница», а вторая — «куда она
   * ведёт», и склеивать их в одну поисковик не просит.
   */
  const jsonLd = [
    breadcrumbJsonLd(crumbs),
    {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: artist,
      url: absoluteUrl(path),
      inLanguage: 'ru',
    },
    itemListJsonLd(
      songs.map((s) => ({
        name: `${s.title} — ${artist}`,
        path: songPath(s),
      })),
      `Песни ${artist} с аккордами`,
    ),
  ];

  return (
    <main className="container-app py-10">
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
        />
      ))}
      <Breadcrumbs crumbs={crumbs} />

      {/* Без mt-*: отступ под крошками задаёт сам компонент крошек. */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Исполнитель</p>
        <h1 className="display text-4xl font-medium">{artist}</h1>
        <p className="mt-2 text-muted">
          {/* Счётчик — из сводки, а не по длине страницы: иначе он показывал бы
              размер порции, а не то, сколько разборов есть всего. */}
          Аккорды на {onNames(summary.instruments)} ·{' '}
          {withPluralRu(summary.total, 'разбор', 'разбора', 'разборов')}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {songs.map((song) => (
          <li key={song.id}>
            <SongRow song={song} meta={songMeta(song, 'artist')} />
          </li>
        ))}
        <LoadMoreSongs
          loadMore={loadMoreArtistSongsAction.bind(null, { artist: decoded })}
          hasMore={hasMore}
          meta="artist"
        />
      </ul>
    </main>
  );
}
