import { ChordDiagram } from './ChordDiagram';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';

/** Карточка аккорда: крупная диаграмма грифа + название (показывается сразу). */
export function ChordCard({
  name,
  customDefs,
  size = 96,
}: {
  name: string;
  customDefs?: Record<string, ChordShape>;
  size?: number;
}) {
  const shape = getChordShape(name, customDefs);
  return (
    <div className="chord-card">
      {shape ? (
        <ChordDiagram frets={shape.frets} barres={shape.barres} name={name} size={size} />
      ) : (
        <div className="chord-card-empty" style={{ width: size, height: (size * 74) / 62 }}>
          —
        </div>
      )}
      <span className="chord-card-name">{name}</span>
    </div>
  );
}
