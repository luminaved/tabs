import type { Barre, ChordFrets } from '@/lib/chords/diagrams';

/**
 * Диаграмма аккорда: 6 струн × 4-5 ладов. Точки — прижатые струны,
 * o/x сверху — открытая/заглушённая, палка — баррэ. Если аккорд высоко на
 * грифе — подпись лада.
 */
export function ChordDiagram({
  frets,
  barres = [],
  name,
  size = 62,
}: {
  frets: ChordFrets;
  barres?: Barre[];
  name?: string;
  size?: number;
}) {
  const FRETS = 4;
  const positives = frets.filter((f) => f > 0);
  const maxFret = positives.length ? Math.max(...positives) : 0;
  const minFret = positives.length ? Math.min(...positives) : 0;
  const base = maxFret > FRETS ? minFret : 1; // окно грифа

  const W = 62;
  const H = 74;
  const left = 9;
  const right = 53;
  const top = 16;
  const bottom = 66;
  const stringGap = (right - left) / 5;
  const fretGap = (bottom - top) / FRETS;
  const x = (s: number) => left + s * stringGap; // s: 0..5 (6-я→1-я струна)
  const y = (f: number) => top + f * fretGap;

  return (
    <svg
      width={size}
      height={(size * H) / W}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={name ? `Аккорд ${name}` : 'Аккорд'}
    >
      {/* Порожек (только если играем от 1 лада) */}
      {base === 1 ? (
        <line x1={left} y1={top} x2={right} y2={top} stroke="currentColor" strokeWidth={3} />
      ) : (
        <text x={left - 5} y={top + fretGap * 0.7} fontSize="7" textAnchor="end" fill="currentColor" opacity="0.7">
          {base}
        </text>
      )}

      {/* Лады */}
      {Array.from({ length: FRETS + 1 }).map((_, i) => (
        <line key={`f${i}`} x1={left} y1={y(i)} x2={right} y2={y(i)} stroke="currentColor" strokeWidth={0.8} opacity="0.35" />
      ))}
      {/* Струны */}
      {Array.from({ length: 6 }).map((_, s) => (
        <line key={`s${s}`} x1={x(s)} y1={top} x2={x(s)} y2={bottom} stroke="currentColor" strokeWidth={0.8} opacity="0.35" />
      ))}

      {/* Баррэ — палка (под точками) */}
      {barres.map((b, i) => {
        const pos = b.fret - base + 1; // 1..FRETS
        if (pos < 1 || pos > FRETS) return null;
        const cy = y(pos) - fretGap / 2;
        const r = 3.4;
        return (
          <rect
            key={`b${i}`}
            x={x(b.from) - r}
            y={cy - r}
            width={x(b.to) - x(b.from) + 2 * r}
            height={2 * r}
            rx={r}
            fill="var(--color-accent)"
          />
        );
      })}

      {frets.map((f, s) => {
        if (f === -1) {
          return (
            <text key={s} x={x(s)} y={top - 4} fontSize="8" textAnchor="middle" fill="currentColor" opacity="0.6">
              ×
            </text>
          );
        }
        if (f === 0) {
          return <circle key={s} cx={x(s)} cy={top - 6} r={2.6} fill="none" stroke="currentColor" strokeWidth={1} opacity="0.7" />;
        }
        const pos = f - base + 1; // 1..FRETS
        return <circle key={s} cx={x(s)} cy={y(pos) - fretGap / 2} r={3.4} fill="var(--color-accent)" />;
      })}
    </svg>
  );
}
