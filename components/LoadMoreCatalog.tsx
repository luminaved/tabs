'use client';

import { useState, useTransition } from 'react';
import type { CatalogSong } from '@/lib/songs';
import type { InstrumentId } from '@/lib/chords/instruments';
import { catalogHref } from '@/lib/catalogUrl';
import { loadMoreCatalogAction } from '@/app/(site)/(catalog)/actions';
import { CatalogRow } from './CatalogRow';
import { LoadMoreLabel } from './LoadMoreLabel';

/**
 * Подгрузка следующих порций каталога.
 *
 * «Показать ещё» — НАСТОЯЩАЯ ссылка на `?page=N`, а не кнопка: клик с
 * работающим JS перехватывается и дописывает строки на месте (как и было), а
 * без JS — и для поискового робота — это обычный переход на следующую
 * страницу. До этого продолжение каталога существовало только как ответ
 * серверного экшена: в разметке его не было, поэтому дальше первой порции
 * обход не заходил и разборы со второй страницы держались в индексе на одной
 * лишь карте сайта.
 *
 * Рендерит `<li>` прямо в общий `<ul>` страницы, поэтому список остаётся одним
 * списком и для разметки, и для скринридера.
 */
export function LoadMoreCatalog({
  query,
  sort,
  instrument,
  verified,
  basePath,
  page: startPage,
  hasMore: initialHasMore,
}: {
  query?: string;
  sort: string;
  instrument: InstrumentId;
  /** Отбор «только подтверждённые» — следующие порции обязаны его учитывать. */
  verified?: boolean;
  /** Адрес каталога инструмента — из него собирается ссылка «дальше». */
  basePath: string;
  /** Показанная сейчас страница, считая с единицы (как в адресе). */
  page: number;
  hasMore: boolean;
}) {
  const [songs, setSongs] = useState<CatalogSong[]>([]);
  const [page, setPage] = useState(startPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // Адрес следующей страницы: он же цель ссылки, он же то, куда уйдёт браузер
  // без JS. Пересобирается на каждый рендер, поэтому после подгрузки ведёт уже
  // на страницу дальше, а не на ту, что уже показана.
  const nextHref = catalogHref(basePath, { query, sort, verified, page: page + 1 });

  const loadMore = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Служебный клик (в новой вкладке, с Shift/Alt, средней кнопкой) не
    // перехватываем: человек попросил именно переход — пусть переходит.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (pending) return;

    const next = page + 1;
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await loadMoreCatalogAction({
          query,
          sort,
          instrument,
          verified,
          // Экшен и БД считают страницы с нуля, адрес — с единицы. `next` уже
          // номер следующей страницы «по-человечески», значит её индекс на
          // единицу меньше — то есть текущий `page`.
          page,
        });
        setSongs((prev) => [...prev, ...result.songs]);
        setHasMore(result.hasMore);
        setPage(next);
      } catch {
        // Сеть отвалилась — ссылку оставляем, чтобы можно было повторить.
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
        <li className="mt-4 flex flex-col items-center gap-2">
          {/* rel="next" — подсказка поисковику, что это продолжение той же
              выдачи, а не отдельная страница. Обычный <a>, поэтому уходит в
              разметку и работает без JS. */}
          <a
            href={nextHref}
            rel="next"
            onClick={loadMore}
            aria-disabled={pending || undefined}
            className="load-more"
          >
            <LoadMoreLabel pending={pending} />
          </a>
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
