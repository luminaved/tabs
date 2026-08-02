'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { parseChordDefs } from '@/lib/chords/diagrams';
import { parseInstrumentId, type InstrumentId } from '@/lib/chords/instruments';
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
  body?: string;
  note?: string | null;
  /** Ссылка на уже сохранённую обложку (/covers/[id]), а НЕ сама картинка. */
  coverSrc?: string | null;
  chordDefs?: string | null;
  visibility?: string;
  instrument?: string;
}

const TEMPLATE = `{start_of_verse}
[C]Первая [G]строка с ак[Am]кордами
[F]над нужными [C]слогами
{end_of_verse}`;

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
  // Инструмент — управляемое состояние: от него зависят аппликатуры (число
  // струн) ещё до отправки формы.
  const [instrument, setInstrument] = useState<InstrumentId>(() =>
    parseInstrumentId(initial?.instrument),
  );
  const preview = useMemo(() => parseSong(body), [body]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
  // Формы разбираются под текущий инструмент: сохранённые шестиструнные к
  // укулеле не подойдут и отсеются (см. parseChordDefs).
  const initialDefs = useMemo(
    () => parseChordDefs(initial?.chordDefs, instrument),
    [initial?.chordDefs, instrument],
  );

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
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  const collect = useCallback((): SongDraftFields | null => {
    const form = formRef.current;
    if (!form) return null;
    const fd = new FormData(form);
    const str = (name: string) => String(fd.get(name) ?? '');
    return {
      title: str('title'),
      artist: str('artist'),
      key: str('key'),
      tempo: str('tempo'),
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

  const applyDraft = (draft: SongDraft) => {
    const form = formRef.current;
    if (form) {
      setFieldValue(form, 'title', draft.title);
      setFieldValue(form, 'artist', draft.artist);
      setFieldValue(form, 'tempo', draft.tempo);
      setFieldValue(form, 'note', draft.note);
    }
    setBody(draft.body);
    setSongKey(draft.key);
    setInstrument(parseInstrumentId(draft.instrument));
    setRestored(draft);
    setRestoreNonce((n) => n + 1);
    setFoundDraft(null);
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
    <form ref={formRef} action={formAction} onChange={scheduleSave} className="flex flex-col gap-6">
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

      {/* Обложка */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Обложка</span>
        <CoverInput initialSrc={initial?.coverSrc} />
      </div>

      {/* Мета-поля */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm text-muted">Название</span>
          <input name="title" required defaultValue={initial?.title ?? ''} className="field" placeholder="Название песни" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Исполнитель</span>
          <input name="artist" defaultValue={initial?.artist ?? ''} className="field" placeholder="Необязательно" />
        </label>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm text-muted">Инструмент</span>
          <InstrumentSelect value={instrument} onChange={setInstrument} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm text-muted">Видимость</span>
          <VisibilitySelect
            key={`vis-${restoreNonce}`}
            initial={restored?.visibility ?? initial?.visibility}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Тональность</span>
          <input
            name="key"
            value={songKey}
            onChange={(e) => setSongKey(e.target.value)}
            className="field"
            placeholder="напр. Am, Bb"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Темп</span>
          <input name="tempo" type="number" min={0} defaultValue={initial?.tempo ?? ''} className="field" placeholder="bpm" />
        </label>
      </div>

      {/* Заметка от автора — показывается над текстом, видна всем */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Заметка от автора (над текстом)</span>
        <textarea
          name="note"
          defaultValue={initial?.note ?? ''}
          rows={2}
          className="field resize-y py-2 text-sm leading-relaxed"
          placeholder="Необязательно: контекст, как играть, посвящение…"
        />
      </label>

      {/* Палитра быстрой вставки — на всю ширину контейнера */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Быстрая вставка аккордов</span>
        <ChordPalette songKey={songKey} used={usedChords} onInsert={insertChord} />
      </div>

      {/* Редактор + живое превью (верх textarea и превью на одном уровне) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          {/* min-h-8 — высота кнопки импорта. Тот же минимум стоит у заголовка
              превью, иначе левая колонка оказывается ниже правой: там подпись
              с кнопкой, тут одна подпись. */}
          <div className="flex min-h-8 items-center justify-between gap-2">
            <span className="text-sm text-muted">Текст (ChordPro)</span>
            <ImportTextDialog onImport={importText} />
          </div>
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
          <div className="flex min-h-8 items-center">
            <span className="text-sm text-muted">Превью</span>
          </div>
          <div
            ref={previewRef}
            onScroll={onPreviewScroll}
            // Аккорды в превью крупнее обычного: лист здесь ужат до 0.9rem, и
            // на 0.64em от него имена аккордов читались с трудом.
            style={
              { '--sheet-font-size': '0.9rem', '--sheet-chord-size': '0.88em' } as CSSProperties
            }
            className="card scroll-thin min-h-[24rem] px-5 py-5 lg:h-[34rem] lg:min-h-0 lg:overflow-auto"
          >
            <ChordSheet song={preview} />
          </div>
        </div>
      </div>

      {/* Аппликатуры аккордов (нестандартные — задаются вручную) */}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">Аппликатуры аккордов</span>
        {/* key с инструментом: при его смене формы пересобираются с нуля —
            у другого инструмента другое число струн. */}
        <ChordDefsEditor
          key={`defs-${restoreNonce}-${instrument}`}
          chords={usedChords}
          instrument={instrument}
          initial={restored ? parseChordDefs(restored.chordDefs, instrument) : initialDefs}
          onEdit={scheduleSave}
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

function DraftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-accent">
      <path d="M12 8v4l2.5 2.5" />
      <path d="M3.05 11a9 9 0 1 1 .5 4" />
      <path d="M3 3v5h5" />
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
