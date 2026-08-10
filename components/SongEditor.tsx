'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
} from 'react';
import Link from 'next/link';
import { ChordSheet } from './ChordSheet';
import { ChordProInput } from './ChordProInput';
import { ChordPalette } from './ChordPalette';
import { ImportTextDialog } from './ImportTextDialog';
import { CoverInput } from './CoverInput';
import { VisibilitySelect } from './VisibilitySelect';
import { InstrumentSelect } from './InstrumentSelect';
import { ChordDefsEditor } from './ChordDefsEditor';
import { parseSong } from '@/lib/chordpro/parse';
import { chordsInOrder } from '@/lib/chordpro/usedChords';
import { normalizePowerFifths, powerFifthPins, powerFifthRenames } from '@/lib/chordpro/powerFifths';
import { getChordShape, parseChordDefs, type ChordShape } from '@/lib/chords/diagrams';
import { getInstrument, parseInstrumentId, type InstrumentId } from '@/lib/chords/instruments';
import { CAPO_MAX, CAPO_MIN, SONG_LIMITS, TEMPO_MAX, TEMPO_MIN } from '@/lib/songLimits';
import { withPluralRu } from '@/lib/plural';
import { songPath } from '@/lib/slug';
import {
  clearDraft,
  draftKey,
  draftSignature,
  formatSavedAt,
  readDraft,
  writeDraft,
  type SongDraft,
  type SongDraftFields,
} from '@/lib/draft';
import type { SongFormState } from '@/app/(site)/songs/actions';

type Action = (prev: SongFormState, formData: FormData) => Promise<SongFormState>;

export interface EditorInitial {
  id?: string;
  title?: string;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  capo?: number | null;
  body?: string;
  note?: string | null;
  /** Ссылка на уже сохранённую обложку (/covers/[id]), а НЕ сама картинка. */
  coverSrc?: string | null;
  chordDefs?: string | null;
  visibility?: string;
  instrument?: string;
}

/**
 * Заготовка в пустом редакторе.
 *
 * Секции размечены серым текстом (`%…%`), а не директивами
 * `{start_of_verse}`/`{end_of_verse}`: заготовку читает человек, впервые
 * открывший редактор, и пара служебных строк вокруг двух строчек текста больше
 * пугает, чем объясняет. `%Куплет 1%` показывает сразу и подпись секции, и сам
 * приём подписывания — тот же, которым пользуются в большинстве присланных
 * табов. Директивы никуда не делись и по-прежнему разбираются (см. parse.ts),
 * просто перестали быть первым, что видно.
 */
const TEMPLATE = `%Куплет 1%
[C]Первая [G]строка с ак[Am]кордами
[F]над нужными [C]слогами

%Припев%
[Am]Здесь припев — [F]аккорды стоят
[C]там же, над [G]своими слогами`;

/** Пауза после последней правки, через которую черновик уходит в хранилище. */
const DRAFT_DEBOUNCE_MS = 700;

/** Подставляет значение в неконтролируемое поле формы (при восстановлении). */
function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value;
}

export function SongEditor({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: EditorInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState(initial?.body ?? TEMPLATE);
  const [songKey, setSongKey] = useState(initial?.key ?? '');
  // Темп, капо и заметка — управляемые, как и тональность. Не ради React как
  // такового: их значения нужны СНАРУЖИ полей, в сводках у свёрнутых разделов
  // («Am · 92 bpm · капо 2»). Читать их из DOM на каждый штрих ради подписи —
  // ровно тот случай, когда состояние дешевле.
  const [tempo, setTempo] = useState(initial?.tempo != null ? String(initial.tempo) : '');
  // Ноль и пустая строка значат одно — «капо нет», — поэтому ноль показываем
  // пустым полем: так же, как это читает сервер (см. lib/songs.ts).
  const [capo, setCapo] = useState(initial?.capo ? String(initial.capo) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  // Инструмент — управляемое состояние: от него зависят аппликатуры (число
  // струн) ещё до отправки формы.
  const [instrument, setInstrument] = useState<InstrumentId>(() =>
    parseInstrumentId(initial?.instrument),
  );
  const preview = useMemo(() => parseSong(body), [body]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // ── Синхронный скролл редактор ↔ превью ──────────────────────────────────
  // Пропорционально (по доле прокрутки), поэтому разные размеры шрифта и высота
  // строк из-за аккордов над текстом не мешают. Замок на пару кадров гасит эхо
  // от программного scrollTop, чтобы панели не «дёргали» друг друга.
  const lockRef = useRef(false);
  const syncScroll = (src: HTMLElement | null, dst: HTMLElement | null) => {
    if (!src || !dst || lockRef.current) return;
    const srcRange = src.scrollHeight - src.clientHeight;
    const dstRange = dst.scrollHeight - dst.clientHeight;
    if (srcRange <= 0 || dstRange <= 0) return;
    lockRef.current = true;
    dst.scrollTop = (src.scrollTop / srcRange) * dstRange;
    requestAnimationFrame(() => requestAnimationFrame(() => (lockRef.current = false)));
  };
  const onEditorScroll = (e: UIEvent<HTMLTextAreaElement>) =>
    syncScroll(e.currentTarget, previewRef.current);
  const onPreviewScroll = (e: UIEvent<HTMLDivElement>) =>
    syncScroll(e.currentTarget, textareaRef.current);

  // Уникальные аккорды, уже встречающиеся в тексте — для быстрого повтора.
  const usedChords = useMemo(() => chordsInOrder(body), [body]);

  // Аккорды, для которых встроенной формы нет: их аппликатуру придётся нарисовать
  // руками, иначе на странице разбора диаграммы у них не будет. Это единственное
  // в форме, что молча требует внимания, — поэтому раздел с аппликатурами
  // раскрывается сам, как только такой аккорд появился в тексте (см. ниже).
  const needingShapes = useMemo(() => {
    const inst = getInstrument(instrument);
    return usedChords.filter((c) => getChordShape(c, inst) === null);
  }, [usedChords, instrument]);

  // Квинты, записанные по-старому («5В»). Такой аккорд не транспонируется —
  // разбор аккордов ждёт корень A-G и оставляет его на месте, — поэтому
  // редактор предлагает замену. Именно предлагает: запрещать нечего, вставленный
  // таб и так рисуется, а лишний барьер на пути к сохранению никому не нужен.
  const oldFifths = useMemo(
    () => powerFifthRenames(body, songKey, instrument),
    [body, songKey, instrument],
  );
  // Два разных старых имени дают одно новое («5В» и «17В» — оба A5). Имя несёт
  // высоту корня, но не позицию, поэтому одну из двух аппликатур замена
  // потеряет. Предупреждаем ДО нажатия: сама замена в этом месте молча
  // закрепляет первую по тексту (см. powerFifthPins).
  const fifthsCollision = useMemo(() => {
    const targets = oldFifths.map((r) => r.to);
    return new Set(targets).size < targets.length;
  }, [oldFifths]);
  // Формы разбираются под текущий инструмент: сохранённые шестиструнные к
  // укулеле не подойдут и отсеются (см. parseChordDefs).
  const initialDefs = useMemo(
    () => parseChordDefs(initial?.chordDefs, instrument),
    [initial?.chordDefs, instrument],
  );

  // ── Складные разделы ──────────────────────────────────────────────────────
  // Открыты, если внутри уже что-то есть: у сохранённого разбора с капо человек
  // должен увидеть капо, не разыскивая его. У пустой формы — закрыты, и до
  // текста песни остаётся один экран вместо трёх.
  const [openParams, setOpenParams] = useState(
    () => !!(initial?.key || initial?.tempo || initial?.capo),
  );
  const [openNote, setOpenNote] = useState(() => !!initial?.note?.trim());
  const [openDefs, setOpenDefs] = useState(false);

  // Сводки для закрытых разделов: что внутри, не раскрывая.
  const paramsHint = useMemo(() => {
    const parts = [
      songKey.trim(),
      tempo.trim() ? `${tempo.trim()} bpm` : '',
      capo.trim() && capo.trim() !== '0' ? `капо ${capo.trim()}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'не задано';
  }, [songKey, tempo, capo]);

  const defsHint = needingShapes.length
    ? `${withPluralRu(needingShapes.length, 'аккорд', 'аккорда', 'аккордов')} без формы`
    : usedChords.length
      ? 'формы стандартные'
      : 'аккордов пока нет';

  // Появился аккорд без встроенной формы — раскрываем раздел. Именно на
  // ПЕРЕХОДЕ «не было → появились», а не при каждом рендере: иначе раздел
  // нельзя было бы свернуть обратно, пока такой аккорд в тексте.
  const prevNeedingRef = useRef(0);
  useEffect(() => {
    if (needingShapes.length > 0 && prevNeedingRef.current === 0) setOpenDefs(true);
    prevNeedingRef.current = needingShapes.length;
  }, [needingShapes.length]);

  // Высота поля заметки по числу строк в нём. Сбрасываем в `auto` перед
  // замером: без сброса `scrollHeight` не может стать меньше уже заданной
  // высоты, и поле умело бы только расти — стерев половину текста, человек
  // остался бы с прежней дырой под ним.
  //
  // `openNote` в зависимостях обязателен: у свёрнутой секции содержимое не
  // отрисовано и `scrollHeight` равен нулю. Без проверки поле получило бы
  // нулевую высоту, а без пересчёта на раскрытии — так и осталось бы с
  // высотой, посчитанной для другого текста.
  useEffect(() => {
    const el = noteRef.current;
    if (!el || !openNote) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note, openNote]);

  // ── Черновик в localStorage ───────────────────────────────────────────────
  // Правки уходят в хранилище с задержкой после последнего ввода. Если вкладку
  // закрыли, не сохранив, при следующем открытии редактор предложит вернуть
  // набранное — сам ничего не подменяет, решает пользователь.
  const formRef = useRef<HTMLFormElement>(null);
  const storageKey = useMemo(() => draftKey(initial?.id), [initial?.id]);

  // Состояние, с которым страница открылась: с ним сравниваем черновик, чтобы
  // не предлагать восстановить ровно то же самое.
  const baseSignature = useMemo(
    () =>
      draftSignature({
        title: initial?.title ?? '',
        artist: initial?.artist ?? '',
        key: initial?.key ?? '',
        tempo: initial?.tempo != null ? String(initial.tempo) : '',
        // Как и в поле формы: ноль — это «без капо», то есть пустая строка.
        // Иначе базовый отпечаток разошёлся бы с собранным из формы, и баннер
        // восстановления предлагал бы вернуть черновик сразу после открытия.
        capo: initial?.capo ? String(initial.capo) : '',
        note: initial?.note ?? '',
        body: initial?.body ?? TEMPLATE,
        visibility: initial?.visibility ?? 'public',
        instrument: parseInstrumentId(initial?.instrument),
        chordDefs: initial?.chordDefs ?? '',
      }),
    [initial],
  );

  const [foundDraft, setFoundDraft] = useState<SongDraft | null>(null);
  const [restored, setRestored] = useState<SongDraft | null>(null);
  // Меняется при восстановлении — пересоздаёт блоки со своим внутренним
  // состоянием (видимость, аппликатуры), чтобы они подхватили новые значения.
  const [restoreNonce, setRestoreNonce] = useState(0);
  // Аппликатуры, навязанные редактору снаружи: их пишет замена квинт, чтобы
  // закрепить позиции, которые новое имя аккорда не выражает. Живут здесь, а не
  // внутри ChordDefsEditor, потому что тот ведёт своё состояние от монтирования
  // и снаружи в него не дотянуться — блок пересобирается по `restoreNonce`.
  const [defsOverride, setDefsOverride] = useState<Record<string, ChordShape> | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  const collect = useCallback((): SongDraftFields | null => {
    const form = formRef.current;
    if (!form) return null;
    // FormData читает ВСЮ форму, включая поля внутри свёрнутых разделов: они
    // остаются в DOM (см. .form-section в globals.css). Поэтому свёрнутое капо
    // попадает и в черновик, и в отправку — ровно как развёрнутое.
    const fd = new FormData(form);
    const str = (name: string) => String(fd.get(name) ?? '');
    return {
      title: str('title'),
      artist: str('artist'),
      key: str('key'),
      tempo: str('tempo'),
      capo: str('capo'),
      note: str('note'),
      body: str('body'),
      visibility: str('visibility'),
      instrument: str('instrument'),
      chordDefs: str('chordDefs'),
    };
  }, []);

  const saveNow = useCallback(() => {
    const fields = collect();
    if (!fields) return;
    // Всё вернулось к исходному — черновик больше не нужен.
    if (draftSignature(fields) === baseSignature) {
      clearDraft(storageKey);
      setSavedAt(null);
      return;
    }
    if (writeDraft(storageKey, fields)) setSavedAt(Date.now());
  }, [collect, baseSignature, storageKey]);

  const scheduleSave = useCallback(() => {
    if (submittedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saveNow();
    }, DRAFT_DEBOUNCE_MS);
  }, [saveNow]);

  // Текст и тональность меняются не только вводом (палитра, импорт), поэтому
  // сохранение вешаем и на само состояние, а не только на onChange формы.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    scheduleSave();
  }, [body, songKey, instrument, scheduleSave]);

  // Уход со страницы (в т.ч. сворачивание вкладки на телефоне) — дописываем
  // отложенное немедленно, иначе последние секунды правок пропадут.
  useEffect(() => {
    const flush = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      saveNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [saveNow]);

  // Предложение восстановить — один раз при открытии редактора.
  useEffect(() => {
    const draft = readDraft(storageKey);
    if (!draft) return;
    if (draftSignature(draft) === baseSignature) {
      clearDraft(storageKey);
      return;
    }
    setFoundDraft(draft);
  }, [storageKey, baseSignature]);

  // Отправка началась — черновик своё отработал.
  useEffect(() => {
    if (!pending) return;
    submittedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearDraft(storageKey);
    setSavedAt(null);
  }, [pending, storageKey]);

  // Сервер вернул ошибку — сохранения не было, значит черновик снова нужен.
  useEffect(() => {
    if (!state.error) return;
    submittedRef.current = false;
    saveNow();
  }, [state, saveNow]);

  // …и раскрываем все разделы. Отказ сервера — это почти всегда превышенная
  // длина поля (см. checkSongFields), а поле может лежать в свёрнутом разделе:
  // без этого человек читал бы «заметка слишком длинная» и не видел ни заметки,
  // ни того, где её искать.
  useEffect(() => {
    if (!state.error) return;
    setOpenParams(true);
    setOpenNote(true);
    setOpenDefs(true);
  }, [state.error]);

  const applyDraft = (draft: SongDraft) => {
    const form = formRef.current;
    if (form) {
      setFieldValue(form, 'title', draft.title);
      setFieldValue(form, 'artist', draft.artist);
    }
    setBody(draft.body);
    setSongKey(draft.key);
    setTempo(draft.tempo);
    setCapo(draft.capo);
    setNote(draft.note);
    setInstrument(parseInstrumentId(draft.instrument));
    setRestored(draft);
    // Аппликатуры берём из черновика, а не из закреплённых прошлой заменой:
    // черновик — более поздняя правда о том, что было в форме.
    setDefsOverride(null);
    setRestoreNonce((n) => n + 1);
    setFoundDraft(null);
    // Вернувшееся из черновика не должно остаться спрятанным: раскрываем ровно
    // те разделы, в которых что-то есть.
    if (draft.key || draft.tempo || draft.capo) setOpenParams(true);
    if (draft.note.trim()) setOpenNote(true);
  };

  const discardDraft = () => {
    clearDraft(storageKey);
    setFoundDraft(null);
    setSavedAt(null);
  };

  // Вставка [Аккорд] строго в позицию курсора. setRangeText читает живое
  // выделение и двигает курсор в конец вставки; controlled-значение затем
  // синхронизируется (курсор и скролл поля не сбрасываются).
  const insertChord = (chord: string) => {
    const token = `[${chord}]`;
    const ta = textareaRef.current;
    if (!ta) {
      setBody((b) => b + token);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    ta.setRangeText(token, start, end, 'end');
    setBody(ta.value);
    ta.focus();
  };

  /**
   * Замена старой записи квинт на стандартные имена.
   *
   * Переписать текст мало: «12В» — это форма на двенадцатом ладу, а имя ей
   * достаётся «E5», у которого встроенная форма стоит на открытых струнах.
   * Поэтому вместе с текстом закрепляем аппликатуры (см. powerFifthPins) —
   * иначе разбор молча уезжал бы на десяток ладов вниз.
   *
   * Что нарисовано сейчас, берём из скрытого поля: его ведёт ChordDefsEditor, и
   * там лежат все формы, заданные в этой сессии, а не только пришедшие из базы.
   * Готовый набор возвращаем ему же через `initial` с пересборкой по nonce.
   */
  const replaceOldFifths = () => {
    const form = formRef.current;
    const raw = form ? String(new FormData(form).get('chordDefs') ?? '') : '';
    const pinned = powerFifthPins(body, parseChordDefs(raw, instrument), songKey, instrument);

    setBody((b) => normalizePowerFifths(b, songKey, instrument));
    setDefsOverride(pinned);
    setRestoreNonce((n) => n + 1);
  };

  // Импорт «аккордов над текстом»: если поле пустое или это шаблон — заменяем
  // целиком, иначе вставляем в позицию курсора (не затираем набранное).
  const importText = (chordpro: string) => {
    const ta = textareaRef.current;
    if (!ta || body.trim() === '' || body === TEMPLATE) {
      setBody(chordpro);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    ta.setRangeText(chordpro, start, end, 'end');
    setBody(ta.value);
    ta.focus();
  };

  return (
    <form ref={formRef} action={formAction} onChange={scheduleSave} className="flex flex-col gap-5">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {foundDraft ? (
        <div className="draft-banner" role="status">
          <DraftIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Остался несохранённый черновик</p>
            <p className="mt-0.5 text-xs text-muted">
              {foundDraft.title ? `«${foundDraft.title}» · ` : ''}
              {formatSavedAt(foundDraft.savedAt)}
            </p>
          </div>
          {/* На телефоне кнопки занимают всю ширину и потому уезжают на свою
              строку: рядом с текстом им не хватало места, тот сжимался в узкий
              столбик и залезал под «Восстановить». От `sm` — как было, в один ряд. */}
          <div className="flex w-full shrink-0 justify-end gap-1.5 sm:w-auto">
            <button
              type="button"
              onClick={() => applyDraft(foundDraft)}
              className="btn btn-primary h-9 px-3 text-sm"
            >
              Восстановить
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="btn btn-ghost h-9 px-3 text-sm"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Шапка: обложка, название, исполнитель ────────────────────────────
          Обложка стоит СБОКУ от названия, а не отдельной полосой над формой:
          отдельной полосой она занимала свою высоту целиком, хотя рядом с ней
          пустовало полстроки. Колонка `auto` — по содержимому обложки с её
          кнопками, вторая забирает остаток. На телефоне обе складываются. */}
      {/* Ширина столбца обложки задана числом, а не `auto`: обложка тянется по
          высоте ряда, и при `auto` её ширина зависела бы от высоты, а высота —
          от соседнего столбца. Браузеры такое разрешают непредсказуемо. */}
      <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Обложка</span>
          <CoverInput initialSrc={initial?.coverSrc} />
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Название</span>
            {/* maxLength здесь — подсказка человеку, а не защита: форма уходит в
                серверный экшен, и настоящий потолок стоит там (lib/songLimits.ts).
                Оба берут одно и то же число, поэтому разойтись не могут.

                Поле обязательное, и поэтому оно ОБЯЗАНО оставаться снаружи
                складных разделов: `required` внутри закрытого <details> браузер
                не может подсветить и отменяет отправку молча. */}
            <input
              name="title"
              required
              maxLength={SONG_LIMITS.title}
              defaultValue={initial?.title ?? ''}
              className="field"
              placeholder="Название песни"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Исполнитель</span>
            <input
              name="artist"
              maxLength={SONG_LIMITS.artist}
              defaultValue={initial?.artist ?? ''}
              className="field"
              placeholder="Необязательно"
            />
          </label>
        </div>
      </div>

      {/* Инструмент — не в складном разделе: от него зависят и аппликатуры, и
          каталог, в котором песня окажется, а выбор из двух карточек стоит одну
          строку. Прятать решение такого веса ради одной строки незачем. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Инструмент</span>
        <InstrumentSelect value={instrument} onChange={setInstrument} />
      </div>

      <FormSection
        title="Параметры разбора"
        hint={paramsHint}
        open={openParams}
        onOpenChange={setOpenParams}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Тональность</span>
            <input
              name="key"
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              maxLength={SONG_LIMITS.key}
              className="field"
              placeholder="напр. Am, Bb"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Темп</span>
            <input
              name="tempo"
              type="number"
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="field"
              placeholder="bpm"
            />
          </label>
          {/* Капо. Колонка была в схеме с самого начала, но форма её не
              заполняла, а страница не показывала — при этом описание разбора в
              выдаче капо обещало. Пустое поле и ноль значат одно: капо нет. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Капо</span>
            <input
              name="capo"
              type="number"
              min={CAPO_MIN}
              max={CAPO_MAX}
              value={capo}
              onChange={(e) => setCapo(e.target.value)}
              className="field"
              placeholder="лад (пусто — без капо)"
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Заметка от автора"
        hint={note.trim() || 'нет'}
        open={openNote}
        onOpenChange={setOpenNote}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Показывается над текстом песни, видна всем</span>
          {/* Ручной ползунок убран, высоту ведёт содержимое (см. эффект выше).
              На телефоне тянуть угол неудобно физически, а промахнувшись —
              вместо растягивания прокручиваешь страницу; поле же короткое и
              заранее знает, сколько ему нужно. Потолок в 14rem не даёт длинной
              заметке вытеснить с экрана всё остальное — дальше своя прокрутка. */}
          <textarea
            ref={noteRef}
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={SONG_LIMITS.note}
            className="field min-h-[4.5rem] max-h-[14rem] resize-none overflow-y-auto py-2 text-sm leading-relaxed"
            placeholder="Необязательно: контекст, как играть, посвящение…"
          />
        </label>
      </FormSection>

      {/* ── Текст песни ──────────────────────────────────────────────────────
          Главный блок формы, и единственный, который никогда не складывается:
          ради него редактор и открывают. Кнопка импорта переехала сюда из шапки
          левой колонки — она относится ко всему разделу, а не к одному полю. */}
      <section className="flex flex-col gap-3">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Текст песни</h2>
          <ImportTextDialog onImport={importText} />
        </div>

        <ChordPalette songKey={songKey} used={usedChords} onInsert={insertChord} />

        {/* Над сеткой, а не в колонке редактора: у левой и правой колонок
            выровнены шапки, и вставка баннера внутрь увела бы textarea вниз
            относительно превью. */}
        {oldFifths.length > 0 ? (
          <div className="draft-banner" role="status">
            <FifthsIcon />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Квинты записаны по-старому</p>
              <p className="mt-0.5 text-xs text-muted">
                {oldFifths.map((r) => `${r.from} → ${r.to}`).join(', ')}. Такие аккорды не
                транспонируются: сдвиг тональности их не двигает. Аппликатуры не изменятся —
                позиции закрепятся на песне.
              </p>
              {fifthsCollision ? (
                <p className="mt-1 text-xs text-accent">
                  Разные позиции дают одно имя, и одна из аппликатур потеряется: имя аккорда
                  несёт высоту, но не лад. Останется первая по тексту — вторую после замены
                  нарисуйте заново.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={replaceOldFifths}
              className="btn btn-primary h-9 shrink-0 px-3 text-sm"
            >
              Заменить
            </button>
          </div>
        ) : null}

        {/* Редактор + живое превью (верх textarea и превью на одном уровне:
            подписи у обеих колонок одинаковые, поэтому выравниваются сами). */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Разметка ChordPro</span>
            <ChordProInput
              ref={textareaRef}
              name="body"
              value={body}
              onChange={setBody}
              onScroll={onEditorScroll}
              className="min-h-[24rem] lg:h-[34rem] lg:min-h-0 lg:resize-none"
            />
            <span className="text-xs text-faint">
              Аккорды в квадратных скобках: <code>[Am]сло[C]во</code>. Серый текст:{' '}
              <code>%текст%</code>. Секции: <code>{'{start_of_chorus}'}</code>,{' '}
              <code>{'{comment: ...}'}</code>.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Превью</span>
            <div
              ref={previewRef}
              onScroll={onPreviewScroll}
              // Аккорды в превью крупнее обычного: лист здесь ужат до 0.9rem, и
              // на 0.64em от него имена аккордов читались с трудом.
              style={
                { '--sheet-font-size': '0.9rem', '--sheet-chord-size': '0.88em' } as CSSProperties
              }
              // Высота фиксирована и на телефоне тоже, со своей прокруткой —
              // как у поля разметки слева. Раньше здесь стоял только `min-h`, и
              // превью росло под длину песни: на телефоне под разметкой
              // разворачивалась вторая копия всего текста, и до аппликатур с
              // кнопкой «Сохранить» приходилось листать её целиком.
              className="card scroll-thin h-[24rem] overflow-auto px-5 py-5 lg:h-[34rem]"
            >
              <ChordSheet song={preview} />
            </div>
          </div>
        </div>
      </section>

      <FormSection
        title="Аппликатуры аккордов"
        hint={defsHint}
        warn={needingShapes.length > 0}
        open={openDefs}
        onOpenChange={setOpenDefs}
      >
        {/* key с инструментом: при его смене формы пересобираются с нуля —
            у другого инструмента другое число струн. */}
        <ChordDefsEditor
          key={`defs-${restoreNonce}-${instrument}`}
          chords={usedChords}
          instrument={instrument}
          initial={
            defsOverride ??
            (restored ? parseChordDefs(restored.chordDefs, instrument) : initialDefs)
          }
          onEdit={scheduleSave}
        />
      </FormSection>

      {/* Видимость стоит вплотную к «Сохранить» и не складывается: это последнее
          решение перед отправкой — куда именно уйдёт разбор. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Видимость</span>
        <VisibilitySelect
          key={`vis-${restoreNonce}`}
          initial={restored?.visibility ?? initial?.visibility}
        />
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? '…' : submitLabel}
        </button>
        {/* Подпись в адресе собирается из СОХРАНЁННЫХ названия и исполнителя:
            «Отмена» ведёт туда, откуда пришли, а не туда, что успели набрать. */}
        <Link
          href={
            initial?.id
              ? songPath({ id: initial.id, title: initial.title ?? '', artist: initial.artist })
              : '/songs'
          }
          className="btn btn-ghost"
        >
          Отмена
        </Link>
        {savedAt ? (
          <span key={savedAt} className="draft-saved" aria-live="polite">
            <CheckIcon />
            Черновик сохранён
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Складной раздел формы. Управляемый: раскрывает его не только клик — ошибка
 * сервера и восстановленный черновик открывают раздел сами, чтобы спрятанное
 * поле не осталось незамеченным (см. эффекты в SongEditor).
 *
 * Внутри именно <details>: поля закрытого раздела остаются в DOM и попадают в
 * FormData, от которой зависят и отправка, и черновик. Подробности и оговорка
 * про `required` — у .form-section в globals.css.
 */
function FormSection({
  title,
  hint,
  warn,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** Сводка справа от заголовка: что внутри, не раскрывая. */
  hint: string;
  /** Сводка просит внимания (есть аккорд без аппликатуры). */
  warn?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="form-section"
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
    >
      <summary>
        <ChevronIcon />
        <span className="form-section-title">{title}</span>
        <span
          className={warn ? 'form-section-hint form-section-hint--warn' : 'form-section-hint'}
        >
          {hint}
        </span>
      </summary>
      <div className="form-section-body">{children}</div>
    </details>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="form-section-chevron">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-accent">
      <path d="M12 8v4l2.5 2.5" />
      <path d="M3.05 11a9 9 0 1 1 .5 4" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/** Стрелки вверх-вниз: запись меняется на другую, равную по смыслу. */
function FifthsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-accent">
      <path d="M7 4v16m0 0-3-3m3 3 3-3" />
      <path d="M17 20V4m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
