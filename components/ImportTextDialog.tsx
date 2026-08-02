'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChordSheet } from './ChordSheet';
import { parseSong } from '@/lib/chordpro/parse';
import { plainToChordPro } from '@/lib/chordpro/plainImport';

// Пример-подсказка в пустом поле. Не строчка из песни, а нейтральная фраза,
// которая заодно объясняет, что произойдёт. Аккорды расставлены по колонкам так,
// чтобы каждый пришёлся на начало слова — видно, что важно именно положение.
const EXAMPLE = `Am      F              C                    G
Простая строчка, чтобы стало видно, как это работает`;

/** Кнопка + модалка: вставка «аккордов над текстом» с авто-конвертом в ChordPro. */
export function ImportTextDialog({ onImport }: { onImport: (chordpro: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [shift, setShift] = useState(0);
  const converted = useMemo(() => plainToChordPro(text, shift), [text, shift]);
  const preview = useMemo(() => parseSong(converted), [converted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const doImport = () => {
    if (!text.trim()) return;
    onImport(converted);
    setText('');
    setShift(0);
    setOpen(false);
  };

  const nudge = (d: number) => setShift((s) => Math.max(-12, Math.min(12, s + d)));

  return (
    <>
      <button
        type="button"
        className="btn btn-outline h-8 gap-1.5 px-3 text-sm"
        onClick={() => {
          setShift(0);
          setOpen(true);
        }}
      >
        <ImportIcon />
        Импорт из текста
      </button>

      {open ? (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="modal-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="display text-2xl font-medium">Импорт из текста</h2>
              <button type="button" className="icon-btn" aria-label="Закрыть" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p className="mb-4 text-sm text-muted">
              Вставьте текст, где аккорды стоят строкой над словами (как на Ultimate-Guitar или в
              текстовых файлах, с пробелами). Аккорды сами встанут в квадратные скобки над нужными
              слогами — справа сразу видно результат.
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted">Вставьте сюда</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  wrap="off"
                  placeholder={EXAMPLE}
                  className="field h-[24rem] resize-none py-3 font-mono text-sm leading-relaxed"
                  style={{ whiteSpace: 'pre', overflowX: 'auto' }}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">Как встанет</span>
                  <div className="flex items-center gap-1" title="Сдвинуть все аккорды на символ">
                    <span className="mr-1 text-xs text-muted">сдвиг аккордов</span>
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 text-base"
                      onClick={() => nudge(-1)}
                      aria-label="Все аккорды на символ назад"
                    >
                      ←
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {shift > 0 ? `+${shift}` : shift}
                    </span>
                    <button
                      type="button"
                      className="icon-btn h-7 w-7 text-base"
                      onClick={() => nudge(1)}
                      aria-label="Все аккорды на символ вперёд"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div
                  className="card h-[24rem] overflow-auto px-4 py-4"
                  style={{ '--sheet-font-size': '0.9rem' } as CSSProperties}
                >
                  {text.trim() ? (
                    <ChordSheet song={preview} />
                  ) : (
                    <p className="text-sm text-faint">Здесь появится результат…</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={doImport} disabled={!text.trim()}>
                Вставить в редактор
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ImportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
