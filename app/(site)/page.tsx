import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicSongs } from '@/lib/songs';
import { SongThumb } from '@/components/SongThumb';
import { SongChordChips } from '@/components/SongChordChips';

export const metadata: Metadata = {
  title: 'Все песни — tabs',
  // Каталог публичных песен, но не для поисковой индексации (см. бриф).
  robots: { index: false, follow: false },
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const songs = await listPublicSongs({ query });

  return (
    <main className="container-app py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Каталог</p>
        <h1 className="display text-4xl font-medium">Все песни</h1>
        <p className="mt-2 text-muted">Публичные разборы со всех аккаунтов.</p>
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
        <div className="card px-6 py-16 text-center text-lg text-muted">
          {query ? 'Ничего не найдено.' : 'Пока нет публичных песен.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li key={song.id}>
              <div className="group relative flex items-center gap-4 rounded-xl border border-line px-3 py-3 transition hover:border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-line))]">
                <SongThumb src={song.coverUrl} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/songs/${song.id}`}
                    className="stretched-link block truncate text-lg font-medium"
                  >
                    {song.title}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span className="truncate">
                      {song.artist || 'без исполнителя'}
                      {song.key ? ` · ${song.key}` : ''}
                      {song.user.name ? (
                        <>
                          {' · '}
                          <Link
                            href={`/u/${song.user.id}`}
                            className="relative z-[1] hover:text-[var(--color-fg)] hover:underline"
                          >
                            {song.user.name}
                          </Link>
                        </>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1" title="Лайки">
                      <HeartIcon />
                      {song._count.likes}
                    </span>
                  </div>
                </div>
                <SongChordChips body={song.body} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function HeartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-muted">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
