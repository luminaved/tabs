import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findArtistName, listSongsByArtist } from '@/lib/songs';
import { SongRow } from '@/components/SongRow';

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const artist = await findArtistName(decodeName(name));
  if (!artist) notFound();

  const title = `${artist} — аккорды всех песен на гитаре`;
  const description =
    `Все разборы ${artist}: аккорды на гитару с текстом, аппликатурами ` +
    'и транспонированием в любую тональность.';

  return {
    title,
    description,
    alternates: { canonical: `/artist/${encodeURIComponent(artist)}` },
    openGraph: {
      type: 'website',
      url: `/artist/${encodeURIComponent(artist)}`,
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
          Аккорды на гитару · {songs.length}{' '}
          {songs.length === 1 ? 'разбор' : songs.length < 5 ? 'разбора' : 'разборов'}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {songs.map((song) => (
          <li key={song.id}>
            <SongRow
              song={song}
              meta={[song.key, 'аккорды'].filter(Boolean).join(' · ')}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
