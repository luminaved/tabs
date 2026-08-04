import Link from 'next/link';
import { listPublicSongs, listTopArtists } from '@/lib/songs';
import { catalogHref, parseCatalogPage, parseSort, parseVerifiedParam } from '@/lib/catalogUrl';
import { INSTRUMENTS, catalogPath, type InstrumentId } from '@/lib/chords/instruments';
import { itemListJsonLd } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { songPath } from '@/lib/slug';
import { CatalogRow } from './CatalogRow';
import { LoadMoreCatalog } from './LoadMoreCatalog';
import { InstrumentTabs } from './InstrumentTabs';
import { SortTabs } from './SortTabs';
import { VerifiedFilter } from './VerifiedFilter';
import { ArtistCloud } from './ArtistCloud';

/**
 * Каталог одного инструмента. Общее тело для `/` (гитара) и `/ukulele` —
 * страницы различаются только инструментом и своими метаданными.
 */
export async function CatalogView({
  instrument,
  searchParams,
}: {
  instrument: InstrumentId;
  searchParams: Promise<{ q?: string; sort?: string; verified?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const sort = parseSort(sp.sort);
  const verified = parseVerifiedParam(sp.verified);
  // В адресе страницы считаются с единицы, в выборке — с нуля.
  const page = parseCatalogPage(sp.page);
  const inst = INSTRUMENTS[instrument];
  const basePath = catalogPath(instrument);

  // Блок исполнителей и разметка списка — только на ПЕРВОЙ странице чистого
  // каталога: на выдаче поиска или отбора они не к месту (человек ищет
  // конкретное), а на второй странице повторять тот же блок ссылок незачем.
  const plain = !query && !verified && sort === 'new' && page === 1;

  const [{ songs, hasMore, fuzzy }, artists] = await Promise.all([
    listPublicSongs({ query, sort, instrument, verified, page: page - 1 }),
    plain ? listTopArtists(instrument) : Promise.resolve([]),
  ]);

  return (
    <main className="container-app py-10">

      {/* Явный перечень того, куда ведёт страница: списки с такой разметкой
          поисковик разбирает охотнее, чем те же ссылки «просто в вёрстке».
          Только на чистом каталоге — на выдаче отбора список непостоянен. */}
      {plain && songs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              itemListJsonLd(
                songs.map((s) => ({
                  name: `${s.title}${s.artist ? ` — ${s.artist}` : ''}`,
                  path: songPath(s),
                })),
                `Аккорды песен для ${inst.forName}`,
              ),
            ),
          }}
        />
      ) : null}

      <div className="mb-6">
        <p className="eyebrow mb-2">Каталог</p>
        <h1 className="display text-4xl font-medium">Аккорды для {inst.forName}</h1>
        <p className="mt-2 text-muted">
          Тексты песен с аккордами над словами, аппликатуры и транспонирование в любую
          тональность. Публичные разборы со всех аккаунтов.
        </p>
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
          {/* Пустая страница «за концом» списка. Ссылок на неё нет ниоткуда
              («Показать ещё» появляется только когда продолжение есть), так что
              попасть сюда можно лишь набрав номер руками — но объяснить, что
              произошло, всё равно надо. */}
          {page > 1
            ? 'Такой страницы в каталоге нет.'
            : query
            ? 'Ничего не найдено.'
            : verified
              ? `Подтверждённых разборов для ${inst.forName} пока нет.`
              : `Пока нет публичных разборов для ${inst.forName}.`}
          {page > 1 ? (
            <div className="mt-4 text-base">
              <Link
                href={catalogHref(basePath, { query, sort, verified })}
                className="text-accent underline-offset-4 hover:underline"
              >
                В начало каталога →
              </Link>
            </div>
          ) : null}
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

          {/* Поиск не дал результата — это ровно та секунда, когда человек
              точно знает, чего хочет, и готов это назвать. Другого такого
              момента на сайте нет, поэтому заявка предлагается именно здесь, а
              не ссылкой в подвале. */}
          {query && !verified ? (
            <div className="mt-4 text-base">
              <Link href="/requests" className="text-accent underline-offset-4 hover:underline">
                Запросить разбор этой песни →
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
          {/* key: при смене запроса/сортировки/отбора/страницы подгруженные
              строки сбрасываются — иначе после перехода на «?page=3» под
              списком остались бы дописанные к прошлой странице. */}
          <LoadMoreCatalog
            key={`${sort}:${verified ? 'v' : ''}:${query ?? ''}:${page}`}
            query={query}
            sort={sort}
            instrument={instrument}
            verified={verified}
            basePath={basePath}
            page={page}
            hasMore={hasMore}
          />
        </ul>
      )}

      {/* Ход назад. Вперёд ведёт «Показать ещё» внутри списка, а сюда попадают
          те, кто пришёл на «?page=N» из поиска или по чужой ссылке: без этой
          ссылки они оказывались бы в середине каталога без пути к его началу.
          rel="prev" — та же подсказка поисковику, что и rel="next". */}
      {page > 1 && songs.length > 0 ? (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Страницы каталога">
          <Link
            href={catalogHref(basePath, { query, sort, verified, page: page - 1 })}
            rel="prev"
            className="text-accent underline-offset-4 hover:underline"
          >
            ← Предыдущая
          </Link>
          <span className="text-faint">Страница {page}</span>
        </nav>
      ) : null}

      <ArtistCloud artists={artists} />

      {/* Постоянный вход в заявки — для тех, кто пришёл не через поиск.
          Только на чистой первой странице, чтобы не мозолить глаза. */}
      {plain ? (
        <p className="mt-8 text-sm text-muted">
          Не нашли песню?{' '}
          <Link href="/requests" className="text-accent underline-offset-4 hover:underline">
            Запросите разбор
          </Link>{' '}
          — что просят чаще, то разбираем раньше.
        </p>
      ) : null}
    </main>
  );
}
