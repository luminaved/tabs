import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getOwnedSong } from '@/lib/songs';
import { coverSrc } from '@/lib/coverUrl';
import { songIdFromParam } from '@/lib/slug';
import { SongEditor } from '@/components/SongEditor';
import { DeleteSongForm } from '@/components/DeleteSongForm';
import { updateSongAction } from '../../actions';

export const metadata: Metadata = {
  title: 'Редактирование',
  robots: { index: false, follow: false },
};

export default async function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  // Сегмент общий со страницей разбора, значит может прийти подписанным —
  // ключ достаём тем же разбором (см. lib/slug.ts).
  const { id } = await params;
  const user = await requireUser();
  const song = await getOwnedSong(songIdFromParam(id), user.id);
  if (!song) notFound();

  return (
    <main className="container-app py-10">
      <p className="eyebrow mb-2">Редактирование</p>
      {/* Исполнитель ВПЕРЕДИ названия — «Кишлак — Скучно».
          Порядок обратный тому, что в разметке для поисковиков («Скучно —
          Кишлак»), и это не небрежность: там строка отвечает на вопрос «что это
          за песня», а здесь — «ту ли я открыл». В своей библиотеке одинаковых
          названий больше, чем одинаковых пар «исполнитель + название», и
          различает их как раз исполнитель, поэтому он и стоит первым. */}
      <h1 className="display mb-8 text-4xl font-medium">
        {song.artist?.trim() ? `${song.artist.trim()} — ${song.title}` : song.title}
      </h1>

      <SongEditor
        action={updateSongAction}
        submitLabel="Сохранить"
        initial={{
          id: song.id,
          title: song.title,
          artist: song.artist,
          key: song.key,
          tempo: song.tempo,
          capo: song.capo,
          body: song.body,
          note: song.note,
          // Ссылка, а не картинка: сам base64 в разметку больше не попадает.
          coverSrc: song.hasCover ? coverSrc(song.id, song.updatedAt) : null,
          chordDefs: song.chordDefs,
          visibility: song.visibility,
          instrument: song.instrument,
        }}
      />

      <div className="mt-10 border-t border-line pt-6">
        <DeleteSongForm id={song.id} />
      </div>
    </main>
  );
}
