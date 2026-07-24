import { chordsInOrder } from '@/lib/chordpro/usedChords';

const MAX = 16;

/** Чипы аккордов песни (в порядке первого появления) для строки списка. */
export function SongChordChips({ body }: { body: string }) {
  const chords = chordsInOrder(body);
  if (chords.length === 0) return null;

  const shown = chords.slice(0, MAX);
  const rest = chords.length - shown.length;

  return (
    <div className="hidden max-w-[45%] flex-wrap justify-end gap-1 sm:flex">
      {shown.map((c, i) => (
        <span key={`${c}-${i}`} className="chip-sm">
          {c}
        </span>
      ))}
      {rest > 0 ? <span className="chip-sm chip-sm--more">+{rest}</span> : null}
    </div>
  );
}
