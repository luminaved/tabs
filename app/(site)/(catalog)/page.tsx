import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicSongs, parseSort } from '@/lib/songs';
import { SongThumb } from '@/components/SongThumb';
import { SongChordChips } from '@/components/SongChordChips';
import { SortTabs } from '@/components/SortTabs';

export const metadata: Metadata = {
  title: 'Аккорды песен на гитару — каталог разборов',
  description:
    'Каталог разборов: аккорды песен на гитару с текстом, аппликатурами и ' +
    'транспонированием. Ищите песню по названию или исполнителю.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Аккорды песен на гитару — каталог разборов',
    description: 'Разборы песен: аккорды над словами, аппликатуры, транспонирование.',
  },
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const sort = parseSort(sp.sort);
  const songs = await listPublicSongs({ query, sort });

  return (
    <main className="container-app py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Каталог</p>
        <h1 className="display text-4xl font-medium">Все песни</h1>
        <p className="mt-2 text-muted">Публичные разборы со всех аккаунтов.</p>
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <form className="flex gap-2" method="get">
          <input
            name="q"
            defaultValue={query ?? ''}
            placeholder="Поиск по названию или исполнителю"
            className="field flex-1"
            autoComplete="off"
          />
          {/* Сортировка переживает поиск */}
          {sort !== 'new' ? <input type="hidden" name="sort" value={sort} /> : null}
          <button type="submit" className="btn btn-outline">
            Найти
          </button>
        </form>
        <SortTabs sort={sort} query={query} />
      </div>

      {songs.length === 0 ? (
        <div className="card px-6 py-16 text-center text-lg text-muted">
          {query ? 'Ничего не найдено.' : 'Пока нет публичных песен.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li key={song.id}>
              <div className="group relative flex items-center gap-4 rounded-xl border border-line px-3 py-3 transition hover:border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-line))]">
                <SongThumb songId={song.id} hasCover={song.hasCover} updatedAt={song.updatedAt} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/songs/${song.id}`}
                    className="stretched-link block truncate text-lg font-medium"
                  >
                    {song.title}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span className="truncate">
                      {/* Исполнитель ведёт на все его разборы. z-[1] — чтобы
                          ссылка работала поверх «растянутой» ссылки строки. */}
                      {song.artist ? (
                        <Link
                          href={`/artist/${encodeURIComponent(song.artist)}`}
                          className="relative z-[1] hover:text-[var(--color-fg)] hover:underline"
                        >
                          {song.artist}
                        </Link>
                      ) : (
                        'без исполнителя'
                      )}
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
                    <span className="flex shrink-0 items-center gap-1" title="Просмотры">
                      <EyeIcon />
                      {song.viewCount}
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

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-muted">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
