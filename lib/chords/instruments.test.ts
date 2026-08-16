import { describe, expect, it } from 'vitest';
import { mod12, noteToPc } from './pitch';
import { DIAGRAM_MIN_ROWS, fretSpan, getChordShape } from './diagrams';
import {
  INSTRUMENTS,
  INSTRUMENT_IDS,
  getInstrument,
  parseInstrumentId,
  soundingPcs,
  stringsLabel,
  type Instrument,
} from './instruments';

/**
 * Независимый «оракул»: интервалы качеств аккорда заданы здесь, в тесте, а не
 * взяты из кода — иначе проверка была бы круговой. Каждая встроенная форма
 * разбирается обратно в звучащие ноты и сверяется с тем, что обещает название.
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
};

/** Разбирает «F#m7» на корень (pitch class) и качество. */
function splitChord(name: string): { rootPc: number; quality: string } | null {
  const m = /^([A-G][#b]*)(.*)$/.exec(name);
  if (!m) return null;
  const rootPc = noteToPc(m[1]);
  if (rootPc === null || !(m[2] in INTERVALS)) return null;
  return { rootPc, quality: m[2] };
}

/**
 * Проверяет, что форма звучит как названный аккорд:
 * лишних нот нет, корень и терция на месте, септима — если она в названии.
 * Квинту разрешаем опустить: на четырёх струнах её часто некуда положить.
 */
function expectSoundsLike(inst: Instrument, name: string, frets: number[]) {
  const parsed = splitChord(name);
  expect(parsed, `не разобрать имя аккорда ${name}`).not.toBeNull();
  const { rootPc, quality } = parsed!;

  const tones = INTERVALS[quality].map((i) => mod12(rootPc + i));
  const sounding = soundingPcs(inst, frets);
  const label = `${inst.id} ${name} [${frets.join(' ')}]`;

  // Ни одной посторонней ноты
  for (const pc of sounding) {
    expect(tones, `${label}: лишняя нота ${pc}`).toContain(pc);
  }
  // Корень
  expect(sounding, `${label}: нет корня`).toContain(mod12(rootPc));
  // Терция (большая или малая — по качеству)
  expect(sounding, `${label}: нет терции`).toContain(tones[1]);
  // Септима у септаккордов
  if (tones.length === 4) {
    expect(sounding, `${label}: нет септимы`).toContain(tones[3]);
  }
}

describe.each(INSTRUMENT_IDS)('инструмент %s', (id) => {
  const inst = INSTRUMENTS[id];

  it('строй и подписи струн согласованы с числом струн', () => {
    expect(inst.openPcs).toHaveLength(inst.strings);
    expect(inst.labels).toHaveLength(inst.strings);
  });

  it('все встроенные открытые формы звучат как их название', () => {
    const names = Object.keys(inst.openShapes);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const frets = inst.openShapes[name];
      expect(frets, `${inst.id} ${name}: не та длина формы`).toHaveLength(inst.strings);
      expectSoundsLike(inst, name, frets);
    }
  });

  it('подвижные формы звучат верно для всех двенадцати корней', () => {
    for (const [quality, build] of Object.entries(inst.movableShapes)) {
      for (let pc = 0; pc < 12; pc++) {
        const frets = build(mod12(pc - inst.movableRootPc));
        const name = `${NOTE_NAMES[pc]}${quality}`;
        expect(frets).toHaveLength(inst.strings);
        expect(Math.min(...frets), `${name}: отрицательный лад`).toBeGreaterThanOrEqual(0);
        expectSoundsLike(inst, name, frets);
      }
    }
  });

  it('квинта есть на каждой из двенадцати высот и звучит корнем с квинтой', () => {
    const build = inst.powerChord;
    if (!build) return;
    for (let pc = 0; pc < 12; pc++) {
      const name = `${NOTE_NAMES[pc]}5`;
      const shape = build(pc);
      const label = `${inst.id} ${name} [${shape.frets.join(' ')}]`;

      expect(shape.frets, `${label}: не та длина формы`).toHaveLength(inst.strings);
      // Квинта — это ровно две высоты: корень и пятая ступень. Ни терции, ни
      // случайно попавшей открытой струны в ней быть не должно.
      expect(soundingPcs(inst, shape.frets), label).toEqual(
        [mod12(pc), mod12(pc + 7)].sort((a, b) => a - b),
      );
      // …и её должно быть видно на диаграмме и можно взять рукой.
      expect(fretSpan(shape.frets), `${label}: неигровой размах`).toBeLessThanOrEqual(
        DIAGRAM_MIN_ROWS,
      );
      expect(Math.min(...shape.frets), `${label}: лад ниже нуля`).toBeGreaterThanOrEqual(-1);
    }
  });

  it('getChordShape отдаёт форму нужной длины для ходовых аккордов', () => {
    for (const name of ['C', 'Am', 'F', 'G7', 'Dm', 'E', 'Bb', 'F#m', 'Ebmaj7']) {
      const shape = getChordShape(name, inst);
      expect(shape, `${inst.id}: нет формы для ${name}`).not.toBeNull();
      expect(shape!.frets).toHaveLength(inst.strings);
      expectSoundsLike(inst, name, shape!.frets);
    }
  });
});

describe('укулеле', () => {
  const uke = INSTRUMENTS.ukulele;

  it('строй GCEA', () => {
    expect(uke.openPcs).toEqual([7, 0, 4, 9]);
    expect(uke.labels).toEqual(['G', 'C', 'E', 'A']);
  });

  it('открытые струны сами по себе дают Am7', () => {
    expect(getChordShape('Am7', uke)).toEqual({ frets: [0, 0, 0, 0] });
  });

  it('C — одним пальцем на третьем ладу первой струны', () => {
    expect(getChordShape('C', uke)).toEqual({ frets: [0, 0, 0, 3] });
  });

  it('квинты «лад + В/Н» — гитарная запись, на укулеле не действует', () => {
    expect(getChordShape('8В', uke)).toBeNull();
    expect(getChordShape('8В', 'guitar')).not.toBeNull();
  });

  /**
   * Формы взяты из уже сохранённых разборов — их рисовали руками, потому что
   * встроенных квинт на укулеле не было. Теперь они встроенные, и таблица
   * обязана совпасть с привычной картинкой: разбор, открытый после обновления,
   * должен выглядеть ровно так же, как выглядел.
   */
  it('квинты стоят там же, где их рисовали руками', () => {
    const drawn: [string, number[]][] = [
      ['C5', [0, 0, 3, 3]],
      ['D5', [2, 2, 5, 5]],
      ['D#5', [3, 3, 6, 6]],
      ['E5', [4, 4, 0, 2]],
      ['F#5', [-1, 1, 2, 4]],
      ['G5', [0, 2, 3, 5]],
      ['A5', [2, 4, 0, 0]],
      ['A#5', [3, -1, 1, 1]],
      ['B5', [4, -1, 2, 2]],
    ];
    for (const [name, frets] of drawn) {
      expect(getChordShape(name, uke)?.frets, name).toEqual(frets);
    }
  });

  it('квинта не уезжает за середину грифа ни на одной высоте', () => {
    // Ради этого таблица и заведена: одна подвижная форма к седьмому корню
    // забиралась бы на двенадцатый лад, куда на сопрано уже не дотянуться.
    for (let pc = 0; pc < 12; pc++) {
      const frets = getChordShape(`${NOTE_NAMES[pc]}5`, uke)!.frets;
      expect(Math.max(...frets), `${NOTE_NAMES[pc]}5 [${frets.join(' ')}]`).toBeLessThanOrEqual(6);
    }
  });

  it('бемоль и диез — одна высота, одна форма', () => {
    expect(getChordShape('Bb5', uke)).toEqual(getChordShape('A#5', uke));
    expect(getChordShape('Eb5', uke)).toEqual(getChordShape('D#5', uke));
  });

  it('подвижная форма даёт баррэ там, где оно реально есть', () => {
    // Bbm7 — палец лежит поперёк всех четырёх струн на первом ладу
    expect(getChordShape('Bbm7', uke)).toEqual({
      frets: [1, 1, 1, 1],
      barres: [{ fret: 1, from: 0, to: 3 }],
    });
  });
});

describe('stringsLabel', () => {
  it('склоняет «струна» по-русски', () => {
    expect(stringsLabel(1)).toBe('1 струна');
    expect(stringsLabel(4)).toBe('4 струны');
    expect(stringsLabel(6)).toBe('6 струн');
    expect(stringsLabel(12)).toBe('12 струн');
    expect(stringsLabel(21)).toBe('21 струна');
  });
});

describe('parseInstrumentId / getInstrument', () => {
  it('известные значения', () => {
    expect(parseInstrumentId('ukulele')).toBe('ukulele');
    expect(parseInstrumentId('guitar')).toBe('guitar');
  });

  it('мусор и пустое — гитара по умолчанию', () => {
    expect(parseInstrumentId(null)).toBe('guitar');
    expect(parseInstrumentId(undefined)).toBe('guitar');
    expect(parseInstrumentId('банджо')).toBe('guitar');
    expect(getInstrument('банджо').strings).toBe(6);
  });
});
