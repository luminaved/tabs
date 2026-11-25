'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { INSTRUMENT_IDS, INSTRUMENTS, type InstrumentId } from '@/lib/chords/instruments';
import type { CatalogMatch } from '@/lib/songRequests';
import {
  deleteRequestAction,
  linkRequestAction,
  requestSongAction,
  searchCatalogAction,
  searchSongsForLinkAction,
  unlinkRequestAction,
  voteRequestAction,
  type RequestFormState,
  type VoteState,
} from '@/app/(site)/requests/actions';

/**
 * Страница заявок как один сценарий: набрал — увидел — сделал.
 *
 * Раньше это были три несвязанных куска: форма сверху, очередь, готовое. Форму
 * заполняли, не глядя в очередь, и «Перемен» можно было завести второй раз,
 * не заметив первую. Теперь вход один — поле «найти или запросить», — и от
 * того, что набрано, зависит, что показано ниже:
 *
 *   — разбор уже в каталоге  → «Открыть»;
 *   — песню уже просят       → «+1» прямо в строке;
 *   — ничего                 → «Запросить», а дальше один шаг: исполнитель.
 *
 * Без запроса в поле — обычная страница: очередь и готовое во вкладках.
 *
 * Администратору у открытой заявки доступна ручная привязка к разбору: автосвязь
 * идёт по названию и исполнителю, и если разбор записан иначе, заявка сама не
 * закроется. После привязки заявка уходит во вкладку «Разобрано».
 *
 * Исполнитель спрашивается ВТОРЫМ шагом, а не вытаскивается из строки вроде
 * «Кино — Перемен»: он обязателен (на нём держится склейка дублей, см.
 * requestMatchKey), а угадывать, что из двух слов название, а что исполнитель,
 * значит молча заводить заявки с перепутанными полями.
 */

export interface BoardRequest {
  id: string;
  title: string;
  artist: string | null;
  instrument: InstrumentId;
  votes: number;
  mine: boolean;
  /** Адрес готового разбора; у открытой заявки null. */
  fulfilledPath: string | null;
  /** Закрыта привязкой, которую администратор поставил вручную. */
  linkedManually: boolean;
}

type Tab = 'open' | 'done';
type InstFilter = 'all' | InstrumentId;

/** Приведение для сравнения «что набрано» с «что есть»: регистр, ё, пробелы. */
function fold(s: string): string {
  return s.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
}

function metaLine(artist: string | null, instrument: InstrumentId): string {
  // «без исполнителя» — для записей, заведённых до того, как поле стало
  // обязательным.
  return `${artist || 'без исполнителя'} · ${INSTRUMENTS[instrument].name.toLowerCase()}`;
}

export function RequestsBoard({
  requests,
  canModerate,
  initialQuery = '',
}: {
  requests: BoardRequest[];
  canModerate: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('open');
  const [inst, setInst] = useState<InstFilter>('all');
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState<RequestFormState['done'] | null>(null);
  const [catalog, setCatalog] = useState<{ q: string; items: CatalogMatch[] }>({
    q: '',
    items: [],
  });

  const q = query.trim();
  const needle = fold(q);
  const searching = needle.length > 0;

  const open = useMemo(() => requests.filter((r) => !r.fulfilledPath), [requests]);
  const done = useMemo(() => requests.filter((r) => r.fulfilledPath), [requests]);

  // Фильтр по инструменту нужен, только если в очереди есть оба. Иначе это
  // переключатель, который ничего не переключает.
  const hasBothInstruments = useMemo(
    () => new Set(requests.map((r) => r.instrument)).size > 1,
    [requests],
  );
  const activeInst: InstFilter = hasBothInstruments ? inst : 'all';
  const byInst = (r: BoardRequest) => activeInst === 'all' || r.instrument === activeInst;

  // ── Подсказка из каталога, с задержкой: запрос уходит на паузе в наборе. ──
  useEffect(() => {
    if (needle.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const items = await searchCatalogAction(q);
        if (!stale) setCatalog({ q, items });
      } catch {
        if (!stale) setCatalog({ q, items: [] });
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, needle]);

  // Результат показываем, только пока он про ТО, что набрано сейчас: иначе при
  // наборе мелькали бы подсказки от предыдущей буквы.
  const catalogItems = catalog.q === q ? catalog.items : [];

  const matchesRequest = (r: BoardRequest) =>
    fold(`${r.title} ${r.artist ?? ''}`).includes(needle);

  // «Уже есть»: найденное в каталоге + закрытые заявки по тому же запросу.
  // Закрытая заявка — это и есть готовый разбор, поэтому склеиваем по адресу.
  const found = useMemo(() => {
    if (!searching) return [];
    const out = new Map<string, { path: string; title: string; artist: string | null; instrument: InstrumentId }>();
    for (const m of catalogItems) out.set(m.path, m);
    for (const r of done) {
      if (r.fulfilledPath && matchesRequest(r) && !out.has(r.fulfilledPath)) {
        out.set(r.fulfilledPath, { ...r, path: r.fulfilledPath });
      }
    }
    return [...out.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, catalogItems, done, needle]);

  const asked = searching ? open.filter(matchesRequest) : [];

  const shownOpen = open.filter(byInst);
  const shownDone = done.filter(byInst);

  const changeQuery = (value: string) => {
    setQuery(value);
    setNotice(null);
  };

  const onRequestDone = (result: NonNullable<RequestFormState['done']>) => {
    // Закрываем форму, но запрос оставляем: человек сразу видит свою строку в
    // очереди с отметкой «Вы просите», а не пустое поле, будто ничего не было.
    setComposing(false);
    setNotice(result);
    setTab('open');
    setInst('all');
  };

  const showCta = searching && !composing && !notice;
  const nothingFound = searching && found.length === 0 && asked.length === 0;

  return (
    <div className="rq">
      <SearchField
        value={query}
        onChange={changeQuery}
        onSubmit={() => searching && !notice && setComposing(true)}
      />

      {notice ? <Notice kind={notice} /> : null}

      {searching ? (
        <>
          {found.length > 0 ? (
            <section className="rq-group" aria-label="Уже есть в каталоге">
              <p className="eyebrow">Уже есть в каталоге</p>
              <ul className="rq-list">
                {found.map((s) => (
                  <li key={s.path} className="rq-item">
                    <Link href={s.path} className="rq-row rq-row--link">
                      <span className="rq-lead rq-lead--done" aria-hidden>
                        <CheckIcon />
                      </span>
                      <div className="rq-main">
                        <p className="rq-title">{s.title}</p>
                        <p className="rq-meta">{metaLine(s.artist, s.instrument)}</p>
                      </div>
                      <OpenHint />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {asked.length > 0 ? (
            <section className="rq-group" aria-label="Уже просят">
              <p className="eyebrow">Уже просят</p>
              <ul className="rq-list">
                {asked.map((r) => (
                  <OpenRow key={r.id} request={r} canModerate={canModerate} />
                ))}
              </ul>
            </section>
          ) : null}

          {showCta ? (
            <button
              type="button"
              className={nothingFound ? 'rq-row rq-cta rq-cta--lead' : 'rq-row rq-cta'}
              onClick={() => setComposing(true)}
            >
              <span className="rq-lead rq-lead--add" aria-hidden>
                <PlusIcon />
              </span>
              <span className="rq-main">
                <span className="rq-title">Запросить «{q}»</span>
                <span className="rq-meta">
                  {nothingFound ? 'Такой песни ещё нет ни в каталоге, ни в очереди' : 'Нет в списке выше? Добавьте заявку'}
                </span>
              </span>
              <ChevronIcon />
            </button>
          ) : null}

          {composing ? (
            <ComposeCard
              title={q}
              defaultInstrument={activeInst === 'all' ? 'guitar' : activeInst}
              onCancel={() => setComposing(false)}
              onDone={onRequestDone}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className="rq-toolbar">
            <div className="seg" role="tablist" aria-label="Заявки">
              <TabButton on={tab === 'open'} onClick={() => setTab('open')} count={shownOpen.length}>
                Ждут разбора
              </TabButton>
              <TabButton on={tab === 'done'} onClick={() => setTab('done')} count={shownDone.length}>
                Разобрано
              </TabButton>
            </div>

            {hasBothInstruments ? (
              <div className="rq-chips" role="group" aria-label="Инструмент">
                {(['all', ...INSTRUMENT_IDS] as InstFilter[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={id === activeInst ? 'rq-chip rq-chip--on' : 'rq-chip'}
                    aria-pressed={id === activeInst}
                    onClick={() => setInst(id)}
                  >
                    {id === 'all' ? 'Все' : INSTRUMENTS[id].name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Правило сортировки названо прямо: без него столбик чисел слева —
              просто числа. С ним видно, что «+1» двигает песню вверх очереди,
              а верх очереди и есть то, что разбирают раньше. */}
          <div className="rq-group" role="tabpanel">
            <p className="rq-caption">
              {tab === 'open'
                ? 'Сверху — то, что просят чаще. «+1» поднимает песню в очереди.'
                : 'Эти песни просили — и они появились. Голосовать за них больше не нужно.'}
            </p>

            {tab === 'open' ? (
              shownOpen.length > 0 ? (
                <ul className="rq-list">
                  {shownOpen.map((r) => (
                    <OpenRow key={r.id} request={r} canModerate={canModerate} />
                  ))}
                </ul>
              ) : (
                <Empty>
                  {open.length === 0
                    ? 'Открытых заявок пока нет. Ваша будет первой — начните с поля выше.'
                    : 'Для этого инструмента открытых заявок нет.'}
                </Empty>
              )
            ) : shownDone.length > 0 ? (
              <ul className="rq-list">
                {shownDone.map((r) => (
                  <li key={r.id} className="rq-item">
                    <Link href={r.fulfilledPath!} className="rq-row rq-row--link">
                      <span className="rq-lead rq-lead--done" aria-hidden>
                        <CheckIcon />
                      </span>
                      <div className="rq-main">
                        <p className="rq-title">{r.title}</p>
                        <p className="rq-meta">{metaLine(r.artist, r.instrument)}</p>
                      </div>
                      <OpenHint />
                    </Link>
                    {canModerate && r.linkedManually ? (
                      <div className="rq-admin rq-admin--done">
                        <span className="rq-admin-note">Привязано вручную</span>
                        <ConfirmButton
                          action={unlinkRequestAction}
                          id={r.id}
                          idle="Отвязать"
                          armed="Точно отвязать?"
                          ariaIdle={`Отвязать «${r.title}» от разбора`}
                          ariaArmed={`Подтвердить: отвязать «${r.title}» от разбора`}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {done.length === 0
                  ? 'Пока ни одна заявка не закрыта. Первый разбор по заявке появится здесь.'
                  : 'Для этого инструмента готовых разборов по заявкам нет.'}
              </Empty>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Поле ──────────────────────────────────────────────────────────────── */

function SearchField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="rq-search">
      <span className="rq-search-ico" aria-hidden>
        <SearchIcon />
      </span>
      <input
        ref={ref}
        type="search"
        value={value}
        maxLength={120}
        autoComplete="off"
        enterKeyHint="go"
        placeholder="Найти или запросить песню"
        aria-label="Название песни"
        className="field rq-input"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          } else if (e.key === 'Escape') {
            onChange('');
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="rq-clear"
          aria-label="Очистить поле"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}

/* ─── Второй шаг: исполнитель и инструмент ──────────────────────────────── */

function ComposeCard({
  title,
  defaultInstrument,
  onCancel,
  onDone,
}: {
  title: string;
  defaultInstrument: InstrumentId;
  onCancel: () => void;
  onDone: (result: NonNullable<RequestFormState['done']>) => void;
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(
    requestSongAction,
    {},
  );
  const [instrument, setInstrument] = useState<InstrumentId>(defaultInstrument);

  useEffect(() => {
    if (state.done) onDone(state.done);
    // onDone приходит новой функцией на каждый рендер родителя — нужна только
    // реакция на новый исход, а не на смену ссылки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="rq-compose">
      {/* Название берётся из поля выше: правится там, а не здесь второй раз. */}
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="instrument" value={instrument} />

      <div className="rq-compose-head">
        <div className="min-w-0">
          <p className="eyebrow">Заявка на разбор</p>
          <p className="rq-compose-title">«{title}»</p>
        </div>
        <button type="button" className="rq-link" onClick={onCancel}>
          Отмена
        </button>
      </div>

      <label className="block">
        <span className="rq-label">Исполнитель</span>
        {/* Обязателен: без исполнителя заявка склеивается с любой песней того
            же названия (см. requestMatchKey). Настоящая проверка — в экшене. */}
        <input
          name="artist"
          required
          autoFocus
          maxLength={120}
          autoComplete="off"
          placeholder="Кто исполняет"
          className="field rq-input rq-input--plain"
        />
      </label>

      <div>
        <span className="rq-label" id="rq-inst-label">
          Инструмент
        </span>
        <div className="seg" role="radiogroup" aria-labelledby="rq-inst-label">
          {INSTRUMENT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === instrument}
              className={id === instrument ? 'seg-item seg-item--on' : 'seg-item'}
              onClick={() => setInstrument(id)}
            >
              {INSTRUMENTS[id].name}
            </button>
          ))}
        </div>
      </div>

      {state.error ? (
        <p className="rq-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary rq-submit">
        {pending ? 'Отправляем…' : 'Запросить разбор'}
      </button>
    </form>
  );
}

/** Три исхода значат для человека разное: объединять их в «спасибо» нельзя. */
function Notice({ kind }: { kind: NonNullable<RequestFormState['done']> }) {
  const text =
    kind === 'created'
      ? 'Заявка добавлена. Если наберёт голоса — разберём в первую очередь.'
      : kind === 'voted'
        ? 'Эту песню уже просили — ваш голос засчитан.'
        : 'Вы уже просили эту песню. Она в списке ниже.';
  return (
    <p className={kind === 'known' ? 'rq-note rq-note--muted' : 'rq-note'} role="status">
      {kind === 'known' ? null : <CheckIcon size={16} />}
      <span>{text}</span>
    </p>
  );
}

/* ─── Строки ────────────────────────────────────────────────────────────── */

function TabButton({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      className={on ? 'seg-item seg-item--on' : 'seg-item'}
      onClick={onClick}
    >
      {children}
      <span className="rq-tab-n">{count}</span>
    </button>
  );
}

/**
 * Открытая заявка с голосом.
 *
 * Клиентская она ради одного: у отказа должно быть объяснение. Экшен отбивает
 * голос при исчерпанном лимите, и раньше это выглядело как сломанная кнопка.
 * Форма при этом остаётся обычной формой с серверным экшеном: без скриптов
 * голос тоже уйдёт, не покажется лишь текст отказа.
 */
function OpenRow({ request, canModerate }: { request: BoardRequest; canModerate: boolean }) {
  const [state, action, pending] = useActionState<VoteState, FormData>(voteRequestAction, {});
  const [linking, setLinking] = useState(false);
  const mine = request.mine;

  return (
    <li className="rq-item">
      <div className="rq-row">
        <span
          className={mine ? 'rq-lead rq-lead--num rq-lead--mine' : 'rq-lead rq-lead--num'}
          title={`Просят: ${request.votes}`}
        >
          <span className="sr-only">Просят: </span>
          {request.votes}
        </span>

        <div className="rq-main">
          <p className="rq-title">{request.title}</p>
          <p className="rq-meta">{metaLine(request.artist, request.instrument)}</p>
          {state.error ? (
            <p className="rq-error rq-error--inline" role="alert">
              {state.error}
            </p>
          ) : null}
          {canModerate ? (
            <div className="rq-admin">
              <button
                type="button"
                className="rq-del rq-del--link"
                aria-expanded={linking}
                onClick={() => setLinking((v) => !v)}
              >
                {linking ? 'Скрыть привязку' : 'Привязать к разбору'}
              </button>
              <DeleteButton id={request.id} title={request.title} />
            </div>
          ) : null}
        </div>

        <form action={action} className="shrink-0">
          {/* Только идентификатор: голос ничего не создаёт. */}
          <input type="hidden" name="id" value={request.id} />
          <button
            type="submit"
            disabled={mine || pending}
            aria-busy={pending}
            className={mine ? 'rq-vote rq-vote--on' : 'rq-vote'}
            aria-label={
              mine
                ? `Вы просите «${request.title}». Всего просят: ${request.votes}`
                : `Поднять «${request.title}» в очереди. Сейчас просят: ${request.votes}`
            }
          >
            {mine ? (
              <>
                <CheckIcon size={16} />
                Вы просите
              </>
            ) : (
              '+1'
            )}
          </button>
        </form>
      </div>

      {canModerate && linking ? (
        <LinkPanel request={request} onClose={() => setLinking(false)} />
      ) : null}
    </li>
  );
}

/**
 * Ручная привязка заявки к разбору — только администратору.
 *
 * Нужна на случай, когда автосвязь промахнулась: она сравнивает название и
 * исполнителя, а разбор может быть записан иначе («Feat.», другое написание).
 * Поле заранее заполнено названием заявки; искать можно и по исполнителю, и
 * вставив ссылку на разбор. Привязать можно только публичный разбор — иначе
 * «Разобрано» показывало бы всем ссылку, которую они не откроют.
 */
function LinkPanel({ request, onClose }: { request: BoardRequest; onClose: () => void }) {
  const [q, setQ] = useState(request.title);
  const [items, setItems] = useState<CatalogMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const found = await searchSongsForLinkAction(q, request.instrument);
        if (!stale) setItems(found);
      } catch {
        if (!stale) {
          setItems([]);
          setError('Не удалось выполнить поиск.');
        }
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, request.instrument]);

  const link = (songId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await linkRequestAction(request.id, songId);
        if (result.error) setError(result.error);
        else onClose();
      } catch {
        setError('Не удалось привязать. Проверьте, что вы вошли как администратор.');
      }
    });
  };

  return (
    <div className="rq-link-panel">
      <label className="block">
        <span className="rq-label">Привязать «{request.title}» к готовому разбору</span>
        <input
          type="search"
          value={q}
          maxLength={300}
          autoFocus
          autoComplete="off"
          placeholder="Название, исполнитель или ссылка на разбор"
          className="field rq-input rq-input--plain"
          onChange={(e) => {
            setQ(e.target.value);
            setItems(null);
            setError(null);
          }}
        />
      </label>

      {items === null ? (
        <p className="rq-meta">Ищем…</p>
      ) : items.length === 0 ? (
        <p className="rq-meta">
          Ничего не найдено. Попробуйте одно слово из названия или вставьте ссылку на разбор.
          Привязать можно только публичный разбор.
        </p>
      ) : (
        <ul className="rq-pick-list">
          {items.map((m) => (
            <li key={m.id} className="rq-pick">
              <div className="rq-main">
                <p className="rq-title">{m.title}</p>
                <p className="rq-meta">{metaLine(m.artist, m.instrument)}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary rq-pick-btn"
                disabled={pending}
                aria-label={`Привязать к разбору «${m.title}»`}
                onClick={() => link(m.id)}
              >
                {pending ? '…' : 'Привязать'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="rq-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className="rq-link rq-link--start" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}

/**
 * Удаление — только администратору, и в два касания: заявка исчезает насовсем,
 * а на телефоне задеть кнопку в строке списка при прокрутке легко.
 *
 * Тип кнопки НЕ меняется между касаниями: смена `button` → `submit` посреди
 * клика заставляла браузер отправить форму уже на первом касании. Второе
 * касание отправляет форму явно.
 */
function DeleteButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmButton
      action={deleteRequestAction}
      id={id}
      idle="Удалить"
      armed="Точно удалить?"
      ariaIdle={`Удалить заявку «${title}»`}
      ariaArmed={`Подтвердить удаление «${title}»`}
    />
  );
}

/** Кнопка администратора в два касания: первое «взводит», второе отправляет. */
function ConfirmButton({
  action,
  id,
  idle,
  armed: armedLabel,
  ariaIdle,
  ariaArmed,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  idle: string;
  armed: string;
  ariaIdle: string;
  ariaArmed: string;
}) {
  const [armed, setArmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        className={armed ? 'rq-del rq-del--armed' : 'rq-del'}
        aria-label={armed ? ariaArmed : ariaIdle}
        onClick={() => (armed ? formRef.current?.requestSubmit() : setArmed(true))}
      >
        {armed ? armedLabel : idle}
      </button>
    </form>
  );
}

function OpenHint() {
  return (
    <span className="rq-open">
      <span className="rq-open-text">Открыть</span>
      <ChevronIcon />
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rq-empty">{children}</p>;
}

/* ─── Иконки ────────────────────────────────────────────────────────────── */

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.9" {...svgProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.2" {...svgProps}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...svgProps}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.2" {...svgProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg className="rq-chev" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
