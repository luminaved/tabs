import { ChordDiagram, diagramHeight, diagramWidth } from './ChordDiagram';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';
import { getInstrument, type Instrument, type InstrumentId } from '@/lib/chords/instruments';

/** Карточка аккорда: крупная диаграмма грифа + название (показывается сразу). */
export function ChordCard({
  name,
  instrument,
  customDefs,
  size = 96,
}: {
  name: string;
  instrument?: Instrument | InstrumentId | null;
  customDefs?: Record<string, ChordShape>;
  size?: number;
}) {
  const inst = typeof instrument === 'object' && instrument ? instrument : getInstrument(instrument);
  const shape = getChordShape(name, inst, customDefs);

  return (
    <div className="chord-card">
      {shape ? (
        <ChordDiagram frets={shape.frets} barres={shape.barres} name={name} size={size} />
      ) : (
        <div
          className="chord-card-empty"
          // Тот же множитель, что у самой диаграммы (см. ChordDiagram): иначе
          // на телефоне карточка «формы нет» осталась бы крупнее соседних.
          style={{
            width: `calc(${diagramWidth(inst.strings, size)}px * var(--chord-scale, 1))`,
            height: `calc(${diagramHeight(inst.strings, size)}px * var(--chord-scale, 1))`,
          }}
        >
          —
        </div>
      )}
      <span className="chord-card-name">{name}</span>
    </div>
  );
}
