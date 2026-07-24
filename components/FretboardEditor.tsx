'use client';

import { useState } from 'react';
import type { ChordFrets } from '@/lib/chords/diagrams';

// Струны от 6-й (толстой) к 1-й, стандартный строй.
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const ROWS = 5;

/** Интерактивный гриф: выбор начального лада + клик по струнам. */
export function FretboardEditor({
  value,
  onChange,
}: {
  value: ChordFrets;
  onChange: (v: ChordFrets) => void;
}) {
  const positives = value.filter((f) => f > 0);
  const suggested = positives.length && Math.max(...positives) > ROWS ? Math.min(...positives) : 1;
  const [base, setBase] = useState(suggested);

  const set = (s: number, val: number) => {
    const next = value.slice();
    next[s] = val;
    onChange(next);
  };

  const cycleHead = (s: number) => {
    const cur = value[s];
    set(s, cur > 0 ? 0 : cur === 0 ? -1 : 0); // прижат→открыт, открыт→глушим, глушим→открыт
  };

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
          const cur = value[s];
          return (
            <button key={`h${s}`} type="button" className="fb-head" onClick={() => cycleHead(s)}>
              {cur === -1 ? '×' : cur === 0 ? '○' : ''}
            </button>
          );
        })}

        {Array.from({ length: ROWS }).map((_, r) => {
          const fret = base + r;
          return STRING_LABELS.map((_, s) => {
            const on = value[s] === fret;
            return (
              <button
                key={`${r}-${s}`}
                type="button"
                className={on ? 'fb-cell fb-cell--on' : 'fb-cell'}
                onClick={() => set(s, on ? 0 : fret)}
                aria-label={`струна ${6 - s}, лад ${fret}`}
              >
                {on ? <span className="fb-dot" /> : null}
              </button>
            );
          });
        })}

        {STRING_LABELS.map((l, s) => (
          <span key={`l${s}`} className="fb-label">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
