'use client';

import { useState, useTransition } from 'react';
import type { SongCard, SongListPage } from '@/lib/engagement';
import { SongRow } from './SongRow';
import { LoadMoreLabel } from './LoadMoreLabel';
import { songMeta, type SongMetaKind } from '@/lib/songMeta';

/**
 * Подгрузка следующих порций для списков карточек: своя библиотека, разборы
 * автора, разборы исполнителя. Каталог рисует другую строку (с ником автора и
 * «растянутой» ссылкой) и потому имеет свой
 * [LoadMoreCatalog](./LoadMoreCatalog.tsx).
 *
 * Первая страница приходит с сервера вместе с HTML, дальше — по кнопке.
 * Строки рендерятся прямо в общий `<ul>` страницы, поэтому список остаётся
 * одним списком и для разметки, и для скринридера.
 *
 * `loadMore` — серверный экшен, уже связанный с фильтрами страницы. Связывание
 * происходит на сервере, но проверять права всё равно обязан сам экшен:
 * связанные аргументы приходят с клиента и доверия им нет.
 */
export function LoadMoreSongs({
  loadMore,
  hasMore: initialHasMore,
  meta,
}: {
  loadMore: (page: number) => Promise<SongListPage>;
  hasMore: boolean;
  /** Что писать во второй строке — см. [songMeta](@/lib/songMeta). */
  meta?: SongMetaKind;
}) {
  const [songs, setSongs] = useState<SongCard[]>([]);
  const [page, setPage] = useState(0); // 0 — уже пришла с сервера
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    const next = page + 1;
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await loadMore(next);
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
          <SongRow song={song} meta={songMeta(song, meta)} />
        </li>
      ))}

      {hasMore ? (
        <li className="mt-4 flex flex-col items-center gap-2">
          {/* aria-disabled, а не disabled: вид «идёт загрузка» задаёт CSS по
              этому же атрибуту (см. .load-more), и он должен совпадать с
              каталогом, где элемент — ссылка и `disabled` к ней неприменим.
              Повторный клик отсекается проверкой в обработчике. */}
          <button
            type="button"
            onClick={onClick}
            aria-disabled={pending || undefined}
            className="load-more"
          >
            <LoadMoreLabel pending={pending} />
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
