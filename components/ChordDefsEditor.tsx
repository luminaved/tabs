'use client';

import { useMemo, useState } from 'react';
import { FretboardEditor } from './FretboardEditor';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';
import { getInstrument, type InstrumentId } from '@/lib/chords/instruments';

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
  instrument,
  onEdit,
}: {
  chords: string[];
  initial: Record<string, ChordShape>;
  instrument?: InstrumentId | null;
  /**
   * Форма правится кликами по грифу, а не полями ввода, поэтому событие
   * `change` до формы не доходит — о правке сообщаем сами (нужно черновику).
   */
  onEdit?: () => void;
}) {
  const inst = getInstrument(instrument);
  const empty = useMemo<ChordShape>(
    () => ({ frets: Array.from({ length: inst.strings }, () => -1) }),
    [inst.strings],
  );

  const needing = chords.filter((c) => getChordShape(c, inst) === null);
  const standard = chords.filter((c) => getChordShape(c, inst) !== null);

  const [defs, setDefs] = useState<Record<string, ChordShape>>(() => {
    const d: Record<string, ChordShape> = {};
    for (const c of chords) if (initial[c]) d[c] = initial[c];
    return d;
  });

  const setVal = (c: string, v: ChordShape) => {
    setDefs((d) => ({ ...d, [c]: v }));
    onEdit?.();
  };
  const reset = (c: string) => {
    setDefs((d) => {
      const { [c]: _drop, ...rest } = d;
      return rest;
    });
    onEdit?.();
  };

  // В форму уходят формы ТОЛЬКО тех аккордов, что сейчас есть в тексте.
  //
  // `defs` живёт от монтирования и накапливает всё, что успели задать. Если
  // аккорд из песни убрали, его форма оставалась в состоянии и продолжала
  // ездить в базу при каждом сохранении — молча, навсегда и на всё растущем
  // объёме. Само состояние не чистим: аккорд могут вернуть в текст тем же
  // движением, и терять из-за этого нарисованную форму было бы обидно.
  const used = useMemo(() => {
    const out: Record<string, ChordShape> = {};
    for (const c of chords) if (defs[c]) out[c] = defs[c];
    return out;
  }, [chords, defs]);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="chordDefs" value={JSON.stringify(used)} />

      {needing.length > 0 ? (
        <>
          <p className="text-sm text-muted">Нестандартные аккорды — задайте форму. {HINT}</p>
          <div className="flex flex-wrap gap-5">
            {needing.map((c) => (
              <div key={c} className="flex flex-col items-center gap-2 rounded-xl border border-line p-4">
                <span className="text-lg font-medium text-accent">{c}</span>
                <FretboardEditor
                  value={defs[c] ?? empty}
                  onChange={(v) => setVal(c, v)}
                  instrument={inst}
                />
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
              const value = custom ?? getChordShape(c, inst) ?? empty;
              return (
                <div
                  key={c}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                    custom ? 'border-accent' : 'border-line'
                  }`}
                >
                  <span className="text-lg font-medium text-accent">{c}</span>
                  <FretboardEditor
                    value={value}
                    onChange={(v) => setVal(c, v)}
                    instrument={inst}
                  />
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
