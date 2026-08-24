import Link from 'next/link';
import { listPublicSongs, listTopArtists } from '@/lib/songs';
import { catalogHref, parseCatalogPage, parseSort, parseVerifiedParam } from '@/lib/catalogUrl';
import { SEARCH_QUERY_MAX } from '@/lib/chordpro/searchText';
import { INSTRUMENTS, catalogPath, type InstrumentId } from '@/lib/chords/instruments';
import { itemListJsonLd } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { songPath } from '@/lib/slug';
import { CatalogRow } from './CatalogRow';
import { EAGER_THUMBS } from './SongThumb';
import { LoadMoreCatalog } from './LoadMoreCatalog';
import { InstrumentTabs } from './InstrumentTabs';
import { SortTabs } from './SortTabs';
import { VerifiedFilter } from './VerifiedFilter';
import { FilterBar } from './FilterBar';
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

      {/*
        Порядок блоков — поиск, потом навигация, потом содержимое, — и он
        собран под телефон, а не под широкий экран.

        Раньше до первой песни стояли надзаголовок «КАТАЛОГ», крупный h1, абзац
        описания, переключатель инструмента, поле поиска с кнопкой и ДВА ряда
        отбора. На телефоне это половина экрана, отданная объяснению того, что
        человек и так уже нашёл: он пришёл искать песню, а не читать про
        каталог. Поэтому надзаголовок и описание ниже `sm` спрятаны, поиск
        поднят к самому верху, а отбор сведён в одну ленту.

        Описание при этом остаётся В РАЗМЕТКЕ (`hidden`, а не удалено): текст
        нужен поисковику, и прятать его показом — обычная адаптивная вёрстка, а
        не подмена содержимого.
      */}
      <div className="mb-5 sm:mb-6">
        <p className="eyebrow mb-2 hidden sm:block">Каталог</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">Аккорды для {inst.forName}</h1>
        <p className="mt-2 hidden text-muted sm:block">
          Тексты песен с аккордами над словами, аппликатуры и транспонирование в любую
          тональность. Публичные разборы со всех аккаунтов.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:mb-8">
        <form className="search" method="get" role="search">
          <SearchIcon />
          {/* maxLength — подсказка человеку, а не защита: форма уходит GET'ом,
              и адрес можно набрать руками. Настоящий потолок стоит на пути в
              базу (см. normalizeSearchQuery), оба берут одно и то же число. */}
          <input
            name="q"
            type="search"
            maxLength={SEARCH_QUERY_MAX}
            defaultValue={query ?? ''}
            placeholder="Найти песню или исполнителя"
            className="field field--search"
            autoComplete="off"
            // Подписывает клавишу отправки на мобильной клавиатуре «Поиском»
            // вместо «Ввода» — без неё исчезнувшая кнопка «Найти» не заменяется
            // ничем очевидным.
            enterKeyHint="search"
            aria-label="Поиск по каталогу"
          />
          {/* Сортировка и отбор переживают поиск: форма отправляется методом
              GET и заменяет строку запроса целиком, поэтому всё, что человек
              уже выбрал, надо унести с собой скрытыми полями. */}
          {sort !== 'new' ? <input type="hidden" name="sort" value={sort} /> : null}
          {verified ? <input type="hidden" name="verified" value="1" /> : null}
          {/* Крестик очистки — ссылка, а не сброс поля: он возвращает к полной
              выдаче, а не просто стирает буквы. Виден, только когда есть что
              снимать. */}
          {query ? (
            <Link
              href={catalogHref(basePath, { sort, verified })}
              className="search-clear"
              aria-label="Очистить поиск"
            >
              <CloseIcon />
            </Link>
          ) : null}
          {/* Видимой кнопки «Найти» больше нет — отправка по Enter. Но submit
              обязан существовать: без него форму не отправить с клавиатуры
              предсказуемым способом, а скринридер не назовёт действие. */}
          <button type="submit" className="sr-only">
            Найти
          </button>
        </form>

        {/* Переключатель инструментов — только на телефоне, и это не полумера.
            От `sm` то же самое стоит в шапке сайта («Гитара» / «Укулеле»), и на
            странице каталога он был вторым таким же в полутора сантиметрах.

            А вот НИЖЕ `sm` шапочная навигация скрыта (см. SiteHeader), в нижней
            панели каталог — один пункт на оба инструмента, и пятый туда не
            влезает (см. MobileNav). Убери эти вкладки совсем — и с телефона на
            укулельный каталог не попасть вообще ниоткуда, кроме как набрав
            /ukulele руками. */}
        <div className="sm:hidden">
          <InstrumentTabs current={instrument} query={query} verified={verified} />
        </div>

        {/* Сортировка и отбор — одним рядом; на телефоне он прокручивается
            вбок, и о продолжении говорит стрелка у края (см. FilterBar). */}
        <FilterBar label="Порядок и отбор">
          <SortTabs sort={sort} query={query} verified={verified} basePath={basePath} />
          <VerifiedFilter on={verified} query={query} sort={sort} basePath={basePath} />
        </FilterBar>
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
          {songs.map((song, i) => (
            <li key={song.id}>
              {/* Первые строки видны сразу — их обложки не откладываем. */}
              <CatalogRow song={song} priority={i < EAGER_THUMBS} />
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

/** Лупа внутри поля поиска — вместо исчезнувшей кнопки «Найти». */
function SearchIcon() {
  return (
    <svg
      className="search-ico"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Крестик очистки поиска. */
function CloseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
