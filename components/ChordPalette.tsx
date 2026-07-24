'use client';

import { useState } from 'react';
import { diatonicChords } from '@/lib/chords/key';

/**
 * Быстрая вставка аккордов: клик по чипу вставляет [Аккорд] в позицию курсора.
 * Показывает аккорды текущей тональности + уже использованные в песне + поле
 * для произвольного. Убирает печать скобок и переключение раскладки.
 */
export function ChordPalette({
  songKey,
  used,
  onInsert,
}: {
  songKey: string;
  used: string[];
  onInsert: (chord: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const diatonic = diatonicChords(songKey);
  const extra = used.filter((c) => !diatonic.includes(c));

  const addCustom = () => {
    const c = custom.trim();
    if (c) {
      onInsert(c);
      setCustom('');
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-[color-mix(in_oklab,var(--color-surface)_45%,transparent)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {diatonic.length ? (
          <>
            <span className="mr-1 text-xs text-muted">Тональность:</span>
            {diatonic.map((c) => (
              <button
                type="button"
                key={c}
                className="chip"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(c)}
              >
                {c}
              </button>
            ))}
          </>
        ) : (
          <span className="text-xs text-muted">Укажите тональность выше — покажу её аккорды.</span>
        )}
      </div>

      {extra.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">В песне:</span>
          {extra.map((c) => (
            <button type="button" key={c} className="chip" onClick={() => onInsert(c)}>
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="свой, напр. F#m7"
          className="field h-8 w-40 text-sm"
        />
        <button
          type="button"
          className="btn btn-outline h-8 px-3 text-sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addCustom}
        >
          Вставить
        </button>
        <span className="ml-1 text-xs text-faint">вставка в позицию курсора</span>
      </div>
    </div>
  );
}
