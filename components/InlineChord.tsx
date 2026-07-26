'use client';

import { useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';
import type { InstrumentId } from '@/lib/chords/instruments';

/** Аккорд в тексте: при наведении/тапе всплывает аппликатура. */
export function InlineChord({
  name,
  instrument,
  customDefs,
}: {
  name: string;
  instrument?: InstrumentId | null;
  customDefs?: Record<string, ChordShape>;
}) {
  const [open, setOpen] = useState(false);
  const shape = getChordShape(name, instrument ?? null, customDefs);

  return (
    <span
      className="inline-chord"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {name}
      {open && shape ? (
        <span className="chord-pop">
          <ChordDiagram frets={shape.frets} barres={shape.barres} name={name} size={84} />
          <span className="chord-pop-name">{name}</span>
        </span>
      ) : null}
    </span>
  );
}
