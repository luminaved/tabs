'use client';

import { useEffect, useRef, useState } from 'react';
import type { Barre, ChordFrets, ChordShape } from '@/lib/chords/diagrams';

// Струны от 6-й (толстой) к 1-й, стандартный строй.
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const ROWS = 5;
const EMPTY_FRETS: ChordFrets = [-1, -1, -1, -1, -1, -1];

/** Интерактивный гриф: выбор начального лада + клик по струнам + баррэ. */
export function FretboardEditor({
  value,
  onChange,
}: {
  value: ChordShape;
  onChange: (v: ChordShape) => void;
}) {
  const frets = value.frets ?? EMPTY_FRETS;
  const barres = value.barres ?? [];
  const positives = frets.filter((f) => f > 0);
  const suggested = positives.length && Math.max(...positives) > ROWS ? Math.min(...positives) : 1;
  const [base, setBase] = useState(suggested);

  // Перетаскивание по одному ряду ладов → баррэ. Пока тянем — держим черновик.
  const [drag, setDrag] = useState<{ row: number; from: number; to: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Баррэ без струны s (клик открытой/глушим по такой струне разрывает баррэ).
  const barresWithout = (s: number) => barres.filter((b) => !(s >= b.from && s <= b.to));

  const withFret = (s: number, val: number): ChordFrets => {
    const next = frets.slice();
    next[s] = val;
    return next;
  };

  const cycleHead = (s: number) => {
    const cur = frets[s];
    const val = cur > 0 ? 0 : cur === 0 ? -1 : 0; // прижат→открыт, открыт→глушим, глушим→открыт
    onChange({ frets: withFret(s, val), barres: barresWithout(s) });
  };

  // Завершение жеста: тянули по нескольким струнам → баррэ; по одной → тоггл.
  const finishDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    const lo = Math.min(d.from, d.to);
    const hi = Math.max(d.from, d.to);
    const fret = base + d.row;

    if (hi > lo) {
      const nextFrets = frets.slice();
      for (let s = lo; s <= hi; s++) nextFrets[s] = fret;
      // убрать баррэ, пересекающиеся с этим на том же ладу, добавить новое
      const nextBarres = barres.filter((b) => !(b.fret === fret && !(hi < b.from || lo > b.to)));
      nextBarres.push({ fret, from: lo, to: hi });
      onChange({ frets: nextFrets, barres: nextBarres });
      return;
    }

    // одиночный клик по ячейке
    const s = lo;
    const covered = barres.find((b) => b.fret === fret && s >= b.from && s <= b.to);
    if (covered) {
      // клик по баррэ — снять его целиком (струны освобождаем)
      const nextFrets = frets.slice();
      for (let i = covered.from; i <= covered.to; i++) nextFrets[i] = 0;
      onChange({ frets: nextFrets, barres: barres.filter((b) => b !== covered) });
    } else if (frets[s] === fret) {
      onChange({ frets: withFret(s, 0), barres });
    } else {
      onChange({ frets: withFret(s, fret), barres });
    }
  };

  // Отпускание мыши где угодно завершает жест.
  useEffect(() => {
    if (!drag) return;
    const up = () => finishDrag();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, frets, barres, base]);

  // Геометрия сетки для абсолютной палки: 6 колонок по 2rem, gap 3px; строка
  // «головы» 1.4rem, затем ряды ладов по 2rem. Точка 1rem по центру ячейки.
  const barStyle = (fret: number, from: number, to: number) => {
    const row = fret - base;
    return {
      left: `calc(${from} * (2rem + 3px) + 0.5rem)`,
      width: `calc(${to - from} * (2rem + 3px) + 1rem)`,
      top: `calc(1.4rem + 3px + ${row} * (2rem + 3px) + 0.5rem)`,
    };
  };

  const pending =
    drag && drag.to !== drag.from
      ? { fret: base + drag.row, from: Math.min(drag.from, drag.to), to: Math.max(drag.from, drag.to) }
      : null;

  return (
    <div className="fb">
      <div className="fb-basectl">
        <span className="text-sm text-muted">Лад</span>
        <button type="button" className="icon-btn h-7 w-7 text-base" onClick={() => setBase((b) => Math.max(1, b - 1))} aria-label="Ниже">
          −
        </button>
        <span className="w-5 text-center tabular-nums">{base}</span>
        <button type="button" className="icon-btn h-7 w-7 text-base" onClick={() => setBase((b) => Math.min(15, b + 1))} aria-label="Выше">
          +
        </button>
      </div>

      <div className={base === 1 ? 'fb-grid fb-grid--nut' : 'fb-grid'}>
        {STRING_LABELS.map((_, s) => {
          const cur = frets[s];
          return (
            <button key={`h${s}`} type="button" className="fb-head" onClick={() => cycleHead(s)}>
              {cur === -1 ? '×' : cur === 0 ? '○' : ''}
            </button>
          );
        })}

        {Array.from({ length: ROWS }).map((_, r) => {
          const fret = base + r;
          return STRING_LABELS.map((_, s) => {
            const on = frets[s] === fret;
            return (
              <button
                key={`${r}-${s}`}
                type="button"
                className={on ? 'fb-cell fb-cell--on' : 'fb-cell'}
                onPointerDown={() => setDrag({ row: r, from: s, to: s })}
                onPointerEnter={() =>
                  setDrag((d) => (d && d.row === r ? { ...d, to: s } : d))
                }
                aria-label={`струна ${6 - s}, лад ${fret}`}
              >
                {on ? <span className="fb-dot" /> : null}
              </button>
            );
          });
        })}

        {/* Сохранённые баррэ */}
        {barres.map((b, i) =>
          b.fret >= base && b.fret < base + ROWS ? (
            <span key={`bar${i}`} className="fb-barre" style={barStyle(b.fret, b.from, b.to)} />
          ) : null,
        )}
        {/* Черновик во время перетаскивания */}
        {pending ? (
          <span className="fb-barre fb-barre--pending" style={barStyle(pending.fret, pending.from, pending.to)} />
        ) : null}

        {STRING_LABELS.map((l, s) => (
          <span key={`l${s}`} className="fb-label">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
