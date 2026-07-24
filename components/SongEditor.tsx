'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChordSheet } from './ChordSheet';
import { ChordPalette } from './ChordPalette';
import { CoverInput } from './CoverInput';
import { VisibilitySelect } from './VisibilitySelect';
import { ChordDefsEditor } from './ChordDefsEditor';
import { parseSong } from '@/lib/chordpro/parse';
import { chordsInOrder } from '@/lib/chordpro/usedChords';
import { parseChordDefs } from '@/lib/chords/diagrams';
import type { SongFormState } from '@/app/(site)/songs/actions';

type Action = (prev: SongFormState, formData: FormData) => Promise<SongFormState>;

export interface EditorInitial {
  id?: string;
  title?: string;
  artist?: string | null;
  key?: string | null;
  capo?: number;
  tempo?: number | null;
  body?: string;
  note?: string | null;
  coverUrl?: string | null;
  chordDefs?: string | null;
  visibility?: string;
}

const TEMPLATE = `{start_of_verse}
[C]Первая [G]строка с ак[Am]кордами
[F]над нужными [C]слогами
{end_of_verse}`;

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
  const preview = useMemo(() => parseSong(body), [body]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Уникальные аккорды, уже встречающиеся в тексте — для быстрого повтора.
  const usedChords = useMemo(() => chordsInOrder(body), [body]);
  const initialDefs = useMemo(() => parseChordDefs(initial?.chordDefs), [initial?.chordDefs]);

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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {/* Обложка */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Обложка</span>
        <CoverInput initial={initial?.coverUrl} />
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
          <span className="text-sm text-muted">Видимость</span>
          <VisibilitySelect initial={initial?.visibility} />
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
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Капо</span>
            <input name="capo" type="number" min={0} max={11} defaultValue={initial?.capo ?? 0} className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Темп</span>
            <input name="tempo" type="number" min={0} defaultValue={initial?.tempo ?? ''} className="field" placeholder="bpm" />
          </label>
        </div>
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

      {/* Редактор + живое превью */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Текст (ChordPro)</span>
          <ChordPalette songKey={songKey} used={usedChords} onInsert={insertChord} />
          <textarea
            ref={textareaRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            className="field min-h-[24rem] resize-y py-3 font-mono text-sm leading-relaxed"
          />
          <span className="text-xs text-faint">
            Аккорды в квадратных скобках: <code>[Am]сло[C]во</code>. Серый текст:{' '}
            <code>%текст%</code>. Секции: <code>{'{start_of_chorus}'}</code>,{' '}
            <code>{'{comment: ...}'}</code>.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Превью</span>
          <div className="card min-h-[24rem] px-5 py-5">
            <ChordSheet song={preview} />
          </div>
        </div>
      </div>

      {/* Аппликатуры аккордов (нестандартные — задаются вручную) */}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">Аппликатуры аккордов</span>
        <ChordDefsEditor chords={usedChords} initial={initialDefs} />
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
        <Link href={initial?.id ? `/songs/${initial.id}` : '/songs'} className="btn btn-ghost">
          Отмена
        </Link>
      </div>
    </form>
  );
}
