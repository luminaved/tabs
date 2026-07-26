import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findArtistName, listSongsByArtist } from '@/lib/songs';
import { INSTRUMENTS, parseInstrumentId, type InstrumentId } from '@/lib/chords/instruments';
import { withPluralRu } from '@/lib/plural';
import { SITE_NAME } from '@/lib/site';
import { SongRow } from '@/components/SongRow';

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Какие инструменты есть среди разборов исполнителя. Страница объединяет оба
 * каталога, поэтому заголовок и мета собираются по факту, а не «на гитаре»
 * всегда: у исполнителя может не быть ни одного гитарного разбора.
 */
function instrumentsOf(songs: { instrument: string }[]): InstrumentId[] {
  const found = new Set<InstrumentId>();
  for (const s of songs) found.add(parseInstrumentId(s.instrument));
  return (['guitar', 'ukulele'] as InstrumentId[]).filter((id) => found.has(id));
}

/** «гитаре» / «укулеле» / «гитаре и укулеле». */
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
  // listSongsByArtist обёрнут в cache(): страница спросит то же самое без
  // повторного запроса к БД.
  const [artist, songs] = await Promise.all([
    findArtistName(decoded),
    listSongsByArtist(decoded),
  ]);
  if (!artist) notFound();

  const on = onNames(instrumentsOf(songs));
  const title = `${artist} — аккорды всех песен на ${on}`;
  const description =
    `Все разборы ${artist}: аккорды на ${on} с текстом, аппликатурами ` +
    'и транспонированием в любую тональность.';

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
  const [artist, songs] = await Promise.all([
    findArtistName(decoded),
    listSongsByArtist(decoded),
  ]);
  if (!artist) notFound();

  return (
    <main className="container-app py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Исполнитель</p>
        <h1 className="display text-4xl font-medium">{artist}</h1>
        <p className="mt-2 text-muted">
          Аккорды на {onNames(instrumentsOf(songs))} ·{' '}
          {withPluralRu(songs.length, 'разбор', 'разбора', 'разборов')}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {songs.map((song) => (
          <li key={song.id}>
            <SongRow song={song} meta={[song.key, 'аккорды'].filter(Boolean).join(' · ')} />
          </li>
        ))}
      </ul>
    </main>
  );
}
