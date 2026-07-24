import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer } from '@/lib/songs';
import { listBySong } from '@/lib/annotations';
import { getSongEngagement } from '@/lib/engagement';
import { SongViewer } from '@/components/SongViewer';

// Личный песенник и шаринг по ссылке — не публичная библиотека чужих текстов.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(id, session?.user?.id);
  return {
    title: song ? `${song.title} — tabs` : 'tabs',
    robots: { index: false, follow: false },
  };
}

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(id, session?.user?.id);
  if (!song) notFound();

  const isOwner = song.userId === session?.user?.id;
  const [annotations, engagement] = await Promise.all([
    isOwner ? listBySong(song.id) : Promise.resolve([]),
    getSongEngagement(song.id, session?.user?.id),
  ]);

  return (
    <main className="container-app pb-28 pt-8">
      <SongViewer
        record={song}
        songId={song.id}
        coverUrl={song.coverUrl}
        note={song.note}
        createdAt={song.createdAt}
        engagement={engagement}
        editHref={isOwner ? `/songs/${song.id}/edit` : undefined}
        annotations={annotations}
        canAnnotate={isOwner}
      />
    </main>
  );
}
