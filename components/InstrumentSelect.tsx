'use client';

import { INSTRUMENTS, stringsLabel, type InstrumentId } from '@/lib/chords/instruments';
import { InstrumentIcon } from './InstrumentIcon';

const OPTIONS: InstrumentId[] = ['guitar', 'ukulele'];

/**
 * Инструмент разбора. Управляемый компонент: от выбора зависят аппликатуры
 * (число струн) и каталог, в котором песня окажется, поэтому редактору нужно
 * знать значение сразу, а не только при отправке формы.
 */
export function InstrumentSelect({
  value,
  onChange,
}: {
  value: InstrumentId;
  onChange: (v: InstrumentId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((v) => {
        const inst = INSTRUMENTS[v];
        return (
          <label key={v} className={v === value ? 'vis-card vis-card--on' : 'vis-card'}>
            <input
              type="radio"
              name="instrument"
              value={v}
              checked={v === value}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            <InstrumentIcon instrument={v} size={20} />
            <span className="vis-card-label">{inst.name}</span>
            <span className="vis-card-desc">
              {stringsLabel(inst.strings)}, строй {inst.labels.join('')}
            </span>
          </label>
        );
      })}
    </div>
  );
}
