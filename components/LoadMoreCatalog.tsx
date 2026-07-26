'use client';

import { useState, useTransition } from 'react';
import type { CatalogSong } from '@/lib/songs';
import type { InstrumentId } from '@/lib/chords/instruments';
import { loadMoreCatalogAction } from '@/app/(site)/(catalog)/actions';
import { CatalogRow } from './CatalogRow';

/**
 * Подгрузка следующих порций каталога. Первая страница приходит с сервера
 * вместе с HTML (и индексируется), дальше — по кнопке.
 *
 * Рендерит `<li>` прямо в общий `<ul>` страницы, поэтому список остаётся одним
 * списком и для разметки, и для скринридера.
 */
export function LoadMoreCatalog({
  query,
  sort,
  instrument,
  verified,
  hasMore: initialHasMore,
}: {
  query?: string;
  sort: string;
  instrument: InstrumentId;
  /** Отбор «только подтверждённые» — следующие порции обязаны его учитывать. */
  verified?: boolean;
  hasMore: boolean;
}) {
  const [songs, setSongs] = useState<CatalogSong[]>([]);
  const [page, setPage] = useState(0); // 0 — с сервера уже пришла
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    const next = page + 1;
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await loadMoreCatalogAction({
          query,
          sort,
          instrument,
          verified,
          page: next,
        });
        setSongs((prev) => [...prev, ...result.songs]);
        setHasMore(result.hasMore);
        setPage(next);
      } catch {
        // Сеть отвалилась — кнопку оставляем, чтобы можно было повторить.
        setFailed(true);
      }
    });
  };

  return (
    <>
      {songs.map((song) => (
        <li key={song.id}>
          <CatalogRow song={song} />
        </li>
      ))}

      {hasMore ? (
        <li className="mt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="btn btn-outline w-full sm:w-auto sm:px-8"
          >
            {pending ? 'Загружаем…' : 'Показать ещё'}
          </button>
          {failed ? (
            <span className="text-sm text-muted" role="alert">
              Не получилось загрузить. Попробуйте ещё раз.
            </span>
          ) : null}
        </li>
      ) : songs.length > 0 ? (
        <li className="mt-3 text-center text-sm text-faint">Это все разборы</li>
      ) : null}
    </>
  );
}
