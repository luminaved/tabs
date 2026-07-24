'use client';

import { useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { getChordShape, type ChordFrets } from '@/lib/chords/diagrams';

/** Аккорд в тексте: при наведении/тапе всплывает аппликатура. */
export function InlineChord({
  name,
  customDefs,
}: {
  name: string;
  customDefs?: Record<string, ChordFrets>;
}) {
  const [open, setOpen] = useState(false);
  const shape = getChordShape(name, customDefs);

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
          <ChordDiagram frets={shape} name={name} size={84} />
          <span className="chord-pop-name">{name}</span>
        </span>
      ) : null}
    </span>
  );
}
