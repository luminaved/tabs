import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { countOwnByInstrument, listSongs } from '@/lib/songs';
import { songMeta } from '@/lib/songMeta';
import { INSTRUMENTS, INSTRUMENT_IDS, type InstrumentId } from '@/lib/chords/instruments';
import { SongRow } from '@/components/SongRow';
import { LoadMoreSongs } from '@/components/LoadMoreSongs';
import { loadMoreLibraryAction } from '@/app/(site)/songs/list-actions';

/** Адрес своей библиотеки для инструмента: гитара живёт на «/songs». */
export function libraryPath(id: InstrumentId): string {
  return id === 'guitar' ? '/songs' : `/songs/${id}`;
}

/**
 * Своя библиотека одного инструмента. Как и публичный каталог, это ДВА
 * отдельных каталога, а не один список с фильтром: у каждого свой адрес,
 * свой счётчик и своя кнопка «добавить» — с уже выбранным инструментом.
 */
export async function LibraryView({
  instrument,
  searchParams,
}: {
  instrument: InstrumentId;
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const inst = INSTRUMENTS[instrument];

  const [{ songs, hasMore }, counts] = await Promise.all([
    listSongs(user.id, { query, instrument }),
    countOwnByInstrument(user.id),
  ]);

  const tabHref = (id: InstrumentId) => {
    const base = libraryPath(id);
    if (!query) return base;
    return `${base}?${new URLSearchParams({ q: query }).toString()}`;
  };

  return (
    <main className="container-app py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Библиотека</p>
          <h1 className="display text-4xl font-medium">Мои {inst.forName}</h1>
        </div>
        {/* Инструмент новой песни уже выбран — редактор откроется с ним */}
        <Link
          href={`/songs/new?instrument=${instrument}`}
          className="btn btn-primary shrink-0"
        >
          + Новая
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <div className="inst-tabs" role="group" aria-label="Инструмент">
          {INSTRUMENT_IDS.map((id) => (
            <Link
              key={id}
              href={tabHref(id)}
              className={id === instrument ? 'inst-tab inst-tab--on' : 'inst-tab'}
              aria-current={id === instrument ? 'true' : undefined}
            >
              {INSTRUMENTS[id].name}
              <span className="inst-tab-count">{counts[id]}</span>
            </Link>
          ))}
        </div>

        <form className="flex gap-2" method="get">
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
      </div>

      {songs.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-lg text-muted">
            {query ? 'Ничего не найдено.' : `Здесь пока нет разборов для ${inst.forName}.`}
          </p>
          {!query ? (
            <Link
              href={`/songs/new?instrument=${instrument}`}
              className="btn btn-primary mt-5"
            >
              Добавить первую песню
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li key={song.id}>
              <SongRow song={song} meta={songMeta(song, 'library')} />
            </li>
          ))}
          {/* key: при смене инструмента/поиска подгруженные строки сбрасываются */}
          <LoadMoreSongs
            key={`${instrument}:${query ?? ''}`}
            loadMore={loadMoreLibraryAction.bind(null, { query, instrument })}
            hasMore={hasMore}
            meta="library"
          />
        </ul>
      )}
    </main>
  );
}
