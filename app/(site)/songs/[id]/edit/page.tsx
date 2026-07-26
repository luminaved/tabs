import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getOwnedSong } from '@/lib/songs';
import { SongEditor } from '@/components/SongEditor';
import { DeleteSongForm } from '@/components/DeleteSongForm';
import { updateSongAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Редактирование — tabs',
  robots: { index: false, follow: false },
};

export default async function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const song = await getOwnedSong(id, user.id);
  if (!song) notFound();

  return (
    <main className="container-app py-10">
      <p className="eyebrow mb-2">Редактирование</p>
      <h1 className="display mb-8 text-4xl font-medium">{song.title}</h1>

      <SongEditor
        action={updateSongAction}
        submitLabel="Сохранить"
        initial={{
          id: song.id,
          title: song.title,
          artist: song.artist,
          key: song.key,
          tempo: song.tempo,
          body: song.body,
          note: song.note,
          coverUrl: song.coverUrl,
          chordDefs: song.chordDefs,
          visibility: song.visibility,
        }}
      />

      <div className="mt-10 border-t border-line pt-6">
        <DeleteSongForm id={song.id} />
      </div>
    </main>
  );
}
