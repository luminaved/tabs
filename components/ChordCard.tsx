import { ChordDiagram } from './ChordDiagram';
import { getChordShape, type ChordFrets } from '@/lib/chords/diagrams';

/** Карточка аккорда: крупная диаграмма грифа + название (показывается сразу). */
export function ChordCard({
  name,
  customDefs,
  size = 96,
}: {
  name: string;
  customDefs?: Record<string, ChordFrets>;
  size?: number;
}) {
  const shape = getChordShape(name, customDefs);
  return (
    <div className="chord-card">
      {shape ? (
        <ChordDiagram frets={shape} name={name} size={size} />
      ) : (
        <div className="chord-card-empty" style={{ width: size, height: (size * 74) / 62 }}>
          —
        </div>
      )}
      <span className="chord-card-name">{name}</span>
    </div>
  );
}
