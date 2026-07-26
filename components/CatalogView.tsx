import Link from 'next/link';
import { listPublicSongs, parseSort } from '@/lib/songs';
import { catalogHref, parseVerifiedParam } from '@/lib/catalogUrl';
import { INSTRUMENTS, catalogPath, type InstrumentId } from '@/lib/chords/instruments';
import { CatalogRow } from './CatalogRow';
import { LoadMoreCatalog } from './LoadMoreCatalog';
import { InstrumentTabs } from './InstrumentTabs';
import { SortTabs } from './SortTabs';
import { VerifiedFilter } from './VerifiedFilter';

/**
 * Каталог одного инструмента. Общее тело для `/` (гитара) и `/ukulele` —
 * страницы различаются только инструментом и своими метаданными.
 */
export async function CatalogView({
  instrument,
  searchParams,
}: {
  instrument: InstrumentId;
  searchParams: Promise<{ q?: string; sort?: string; verified?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const sort = parseSort(sp.sort);
  const verified = parseVerifiedParam(sp.verified);
  const inst = INSTRUMENTS[instrument];
  const basePath = catalogPath(instrument);

  const { songs, hasMore, fuzzy } = await listPublicSongs({
    query,
    sort,
    instrument,
    verified,
  });

  return (
    <main className="container-app py-10">
      <div className="mb-6">
        <p className="eyebrow mb-2">Каталог</p>
        <h1 className="display text-4xl font-medium">Аккорды для {inst.forName}</h1>
        <p className="mt-2 text-muted">Публичные разборы со всех аккаунтов.</p>
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <InstrumentTabs current={instrument} query={query} verified={verified} />

        <form className="flex gap-2" method="get">
          <input
            name="q"
            defaultValue={query ?? ''}
            placeholder="Поиск по названию или исполнителю"
            className="field flex-1"
            autoComplete="off"
          />
          {/* Сортировка и отбор переживают поиск: форма отправляется методом
              GET и заменяет строку запроса целиком, поэтому всё, что человек
              уже выбрал, надо унести с собой скрытыми полями. */}
          {sort !== 'new' ? <input type="hidden" name="sort" value={sort} /> : null}
          {verified ? <input type="hidden" name="verified" value="1" /> : null}
          <button type="submit" className="btn btn-outline">
            Найти
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <SortTabs sort={sort} query={query} verified={verified} basePath={basePath} />
          <VerifiedFilter on={verified} query={query} sort={sort} basePath={basePath} />
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="card px-6 py-16 text-center text-lg text-muted">
          {query
            ? 'Ничего не найдено.'
            : verified
              ? `Подтверждённых разборов для ${inst.forName} пока нет.`
              : `Пока нет публичных разборов для ${inst.forName}.`}
          {/* С включённым отбором пустая выдача чаще всего означает не «нет
              такой песни», а «она есть, но её ещё не проверил модератор» —
              поэтому даём выход одним кликом, а не отправляем искать заново. */}
          {verified ? (
            <div className="mt-4 text-base">
              <Link
                href={catalogHref(basePath, { query, sort })}
                className="text-accent underline-offset-4 hover:underline"
              >
                Показать все разборы →
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {/* Точного совпадения не было — честно предупреждаем, что это подбор */}
          {fuzzy ? (
            <li className="mb-1 text-sm text-muted">
              По запросу «{query}» ничего не нашлось. Показаны похожие.
            </li>
          ) : null}
          {songs.map((song) => (
            <li key={song.id}>
              <CatalogRow song={song} />
            </li>
          ))}
          {/* key: при смене запроса/сортировки/отбора подгруженные строки сбрасываются */}
          <LoadMoreCatalog
            key={`${sort}:${verified ? 'v' : ''}:${query ?? ''}`}
            query={query}
            sort={sort}
            instrument={instrument}
            verified={verified}
            hasMore={hasMore}
          />
        </ul>
      )}
    </main>
  );
}
