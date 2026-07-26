'use client';

import { useState } from 'react';
import { FretboardEditor } from './FretboardEditor';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';

const EMPTY: ChordShape = { frets: [-1, -1, -1, -1, -1, -1] };

const HINT = (
  <>
    Выберите начальный лад и отметьте кнопкой струны, которые зажимаются. Кнопка сверху струны
    переключает открытую (○) / заглушённую (×). Для <b>баррэ</b> — зажмите и протяните мышью
    вдоль одного лада; клик по палке убирает её.
  </>
);

/**
 * Аппликатуры аккордов песни. Нестандартные (без встроенной формы) — сверху,
 * их задать обязательно. Стандартные — ниже, в раскрывающемся блоке: их форма
 * вычисляется автоматически, но её можно переопределить своей и сбросить назад.
 */
export function ChordDefsEditor({
  chords,
  initial,
}: {
  chords: string[];
  initial: Record<string, ChordShape>;
}) {
  const needing = chords.filter((c) => getChordShape(c) === null);
  const standard = chords.filter((c) => getChordShape(c) !== null);

  const [defs, setDefs] = useState<Record<string, ChordShape>>(() => {
    const d: Record<string, ChordShape> = {};
    for (const c of chords) if (initial[c]) d[c] = initial[c];
    return d;
  });

  const setVal = (c: string, v: ChordShape) => setDefs((d) => ({ ...d, [c]: v }));
  const reset = (c: string) =>
    setDefs((d) => {
      const { [c]: _drop, ...rest } = d;
      return rest;
    });

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="chordDefs" value={JSON.stringify(defs)} />

      {needing.length > 0 ? (
        <>
          <p className="text-sm text-muted">Нестандартные аккорды — задайте форму. {HINT}</p>
          <div className="flex flex-wrap gap-5">
            {needing.map((c) => (
              <div key={c} className="flex flex-col items-center gap-2 rounded-xl border border-line p-4">
                <span className="text-lg font-medium text-accent">{c}</span>
                <FretboardEditor value={defs[c] ?? EMPTY} onChange={(v) => setVal(c, v)} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {standard.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Стандартные аккорды — форма подставляется автоматически, здесь её можно заменить своей
            (например, другой позицией на грифе). {HINT}
          </p>
          <div className="flex flex-wrap gap-5">
            {standard.map((c) => {
              const custom = defs[c];
              const value = custom ?? getChordShape(c) ?? EMPTY;
              return (
                <div
                  key={c}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                    custom ? 'border-accent' : 'border-line'
                  }`}
                >
                  <span className="text-lg font-medium text-accent">{c}</span>
                  <FretboardEditor value={value} onChange={(v) => setVal(c, v)} />
                  {custom ? (
                    <button
                      type="button"
                      onClick={() => reset(c)}
                      className="btn btn-ghost h-7 px-2 text-xs"
                    >
                      сбросить к стандартной
                    </button>
                  ) : (
                    <span className="text-xs text-faint">стандартная</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {chords.length === 0 ? (
        <p className="text-sm text-faint">
          Аккорды появятся здесь, как только они будут в тексте песни.
        </p>
      ) : null}
    </div>
  );
}
