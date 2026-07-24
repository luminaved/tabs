import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { listSongs } from '@/lib/songs';
import { SongRow } from '@/components/SongRow';

export const metadata: Metadata = {
  title: 'Мои песни — tabs',
  robots: { index: false, follow: false },
};

const VIS_LABEL: Record<string, string> = {
  private: 'приватная',
  unlisted: 'по ссылке',
  public: 'публичная',
};

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;

  const songs = await listSongs(user.id, { query });

  return (
    <main className="container-app py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Библиотека</p>
          <h1 className="display text-4xl font-medium">Мои песни</h1>
        </div>
        <Link href="/songs/new" className="btn btn-primary shrink-0">
          + Новая
        </Link>
      </div>

      <form className="mb-8 flex gap-2" method="get">
        <input
          name="q"
          defaultValue={query ?? ''}
          placeholder="Поиск по названию или исполнителю"
          className="field flex-1"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-outline">
          Найти
        </button>
      </form>

      {songs.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-lg text-muted">{query ? 'Ничего не найдено.' : 'Пока пусто.'}</p>
          {!query ? (
            <Link href="/songs/new" className="btn btn-primary mt-5">
              Добавить первую песню
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li key={song.id}>
              <SongRow
                song={song}
                meta={[song.artist || 'без исполнителя', song.key, VIS_LABEL[song.visibility]]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
