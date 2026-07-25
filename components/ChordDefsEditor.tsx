'use client';

import { useState } from 'react';
import { FretboardEditor } from './FretboardEditor';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';

const EMPTY: ChordShape = { frets: [-1, -1, -1, -1, -1, -1] };

/**
 * Задание аппликатур для аккордов без встроенной формы (нестандартные
 * обозначения). Стандартные сюда не попадают — их формы вычисляются сами.
 */
export function ChordDefsEditor({
  chords,
  initial,
}: {
  chords: string[];
  initial: Record<string, ChordShape>;
}) {
  const needing = chords.filter((c) => getChordShape(c) === null);

  const [defs, setDefs] = useState<Record<string, ChordShape>>(() => {
    const d: Record<string, ChordShape> = {};
    for (const c of chords) if (initial[c]) d[c] = initial[c];
    return d;
  });

  const setVal = (c: string, v: ChordShape) => setDefs((d) => ({ ...d, [c]: v }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="chordDefs" value={JSON.stringify(defs)} />

      {needing.length === 0 ? (
        <p className="text-sm text-faint">
          Все аккорды стандартные — аппликатуры показываются автоматически.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Нестандартные аккорды: выберите начальный лад и отметьте кнопкой струны, которые
            зажимаются. Кнопка сверху струны переключает открытую (○) / заглушённую (×).
            Для <b>баррэ</b> — зажмите и протяните мышью вдоль одного лада; клик по палке
            убирает её.
          </p>
          <div className="flex flex-wrap gap-5">
            {needing.map((c) => (
              <div key={c} className="flex flex-col items-center gap-2 rounded-xl border border-line p-4">
                <span className="text-lg font-medium text-accent">{c}</span>
                <FretboardEditor value={defs[c] ?? EMPTY} onChange={(v) => setVal(c, v)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
