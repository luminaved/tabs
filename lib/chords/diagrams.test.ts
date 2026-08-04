import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_MAX_ROWS,
  DIAGRAM_MIN_ROWS,
  EDITOR_FRET_ROWS,
  fretSpan,
  fretWindow,
  getChordShape,
  parseChordDefs,
  parseFrets,
  parsePowerFifth,
  powerFifthToChordName,
} from './diagrams';

describe('fretSpan', () => {
  it('открытые и заглушённые струны в размах не входят', () => {
    expect(fretSpan([-1, 0, 2, 2, 1, 0])).toBe(2); // Am: лады 1..2
    expect(fretSpan([-1, -1, 0, 0, 0, 0])).toBe(0); // прижатых нет вовсе
  });

  it('считает от самого нижнего прижатого лада до самого верхнего', () => {
    expect(fretSpan([1, 3, 3, 2, 1, 1])).toBe(3); // F: лады 1..3
    expect(fretSpan([-1, 1, 3, 3, 6, -1])).toBe(6); // 1..6
  });
});

describe('fretWindow', () => {
  it('обычные аккорды рисуются от порожка четырьмя ладами — как раньше', () => {
    // Ни один встроенный аккорд не должен изменить картинку: это проверка
    // того, что починка широких форм не задела все остальные.
    expect(fretWindow([-1, 3, 2, 0, 1, 0])).toEqual({ base: 1, rows: DIAGRAM_MIN_ROWS }); // C
    expect(fretWindow([1, 3, 3, 2, 1, 1])).toEqual({ base: 1, rows: DIAGRAM_MIN_ROWS }); // F
    expect(fretWindow([-1, 2, 4, 4, 3, 2])).toEqual({ base: 1, rows: DIAGRAM_MIN_ROWS }); // Bm
  });

  it('высокая, но узкая форма сдвигает окно, не расширяя его', () => {
    // G#m — барре на 4 ладу, лады 4..6: окно с четвёртого, ширина прежняя.
    expect(fretWindow([4, 6, 6, 4, 4, 4])).toEqual({ base: 4, rows: DIAGRAM_MIN_ROWS });
  });

  it('широкая форма получает лишние ряды вместо потерянной точки', () => {
    // Ровно тот случай, который редактор позволял нарисовать, а диаграмма
    // роняла за нижний край холста.
    expect(fretWindow([1, 3, 3, 2, 1, 5])).toEqual({ base: 1, rows: 5 });
    expect(fretWindow([-1, 1, 3, 3, 6, -1])).toEqual({ base: 1, rows: 6 });
  });

  it('форма без прижатых струн — обычное окно от порожка', () => {
    expect(fretWindow([0, 0, 0, 0, 0, 0])).toEqual({ base: 1, rows: DIAGRAM_MIN_ROWS });
    expect(fretWindow([-1, -1, -1, -1, -1, -1])).toEqual({ base: 1, rows: DIAGRAM_MIN_ROWS });
  });

  it('каждая прижатая струна попадает в окно — это и есть инвариант', () => {
    const shapes = [
      [-1, 3, 2, 0, 1, 0],
      [4, 6, 6, 4, 4, 4],
      [1, 3, 3, 2, 1, 5],
      [-1, 1, 3, 3, 6, -1],
      [7, 9, 9, 8, 7, 7],
      [0, 2, 2, 1, 0, 0],
    ];
    for (const frets of shapes) {
      const { base, rows } = fretWindow(frets);
      for (const f of frets.filter((n) => n > 0)) {
        const pos = f - base + 1;
        expect(pos, `лад ${f} в форме [${frets}]`).toBeGreaterThanOrEqual(1);
        expect(pos, `лад ${f} в форме [${frets}]`).toBeLessThanOrEqual(rows);
      }
    }
  });
});

describe('согласованность редактора и диаграммы', () => {
  it('редактор не даёт отметить лад, который диаграмма не нарисует', () => {
    // Из-за расхождения этих двух чисел форма, нарисованная в редакторе, молча
    // теряла точку на странице разбора. Тест не даёт им разъехаться снова.
    expect(EDITOR_FRET_ROWS).toBeLessThanOrEqual(DIAGRAM_MAX_ROWS);
  });

  it('окно диаграммы не у́же обычного и не шире потолка', () => {
    expect(DIAGRAM_MIN_ROWS).toBeLessThanOrEqual(DIAGRAM_MAX_ROWS);
  });

  it('любая форма из редактора укладывается в окно диаграммы', () => {
    // Самое широкое, что можно нарисовать: точка в первом ряду и в последнем.
    const widest = [1, -1, -1, -1, -1, EDITOR_FRET_ROWS];
    const { base, rows } = fretWindow(widest);
    expect(EDITOR_FRET_ROWS - base + 1).toBeLessThanOrEqual(rows);
  });
});

describe('getChordShape', () => {
  it('встроенные open-аккорды', () => {
    expect(getChordShape('C')).toEqual({ frets: [-1, 3, 2, 0, 1, 0] });
    expect(getChordShape('Am')).toEqual({ frets: [-1, 0, 2, 2, 1, 0] });
  });

  it('генерирует барре-форму для нестандартных корней (с палкой баррэ)', () => {
    // F#m — E-форма минора, барре на 2 ладу (F# = pc6, 6-4=2)
    expect(getChordShape('F#m')).toEqual({
      frets: [2, 4, 4, 2, 2, 2],
      barres: [{ fret: 2, from: 0, to: 5 }],
    });
    // G#m — барре на 4 ладу
    expect(getChordShape('G#m')).toEqual({
      frets: [4, 6, 6, 4, 4, 4],
      barres: [{ fret: 4, from: 0, to: 5 }],
    });
  });

  it('встроенные барре-аккорды рисуются палкой', () => {
    // F — баррэ на 1 ладу через все шесть струн
    expect(getChordShape('F')?.barres).toEqual([{ fret: 1, from: 0, to: 5 }]);
    // Bm — баррэ на 2 ладу, 6-я струна заглушена → струны 1..5
    expect(getChordShape('Bm')?.barres).toEqual([{ fret: 2, from: 1, to: 5 }]);
  });

  it('аккорды с открытыми струнами и квинты — без баррэ (точками)', () => {
    expect(getChordShape('C')?.barres).toBeUndefined();
    expect(getChordShape('Am')?.barres).toBeUndefined();
    expect(getChordShape('G')?.barres).toBeUndefined();
    expect(getChordShape('8В')?.barres).toBeUndefined();
    expect(getChordShape('3Н')?.barres).toBeUndefined();
  });

  it('бас в slash-аккорде игнорируется', () => {
    expect(getChordShape('D/F#')).toEqual({ frets: [-1, -1, 0, 2, 3, 2] });
  });

  it('кастомная аппликатура имеет приоритет', () => {
    expect(getChordShape('2Н', 'guitar', { '2Н': { frets: [-1, -1, 3, 3, 3, -1] } })).toEqual({
      frets: [-1, -1, 3, 3, 3, -1],
    });
  });

  it('кастомная аппликатура с баррэ', () => {
    const shape = { frets: [1, 3, 3, 2, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] };
    expect(getChordShape('Fbar', 'guitar', { Fbar: shape })).toEqual(shape);
  });

  it('квинты (power chords) в нотации лад+В/Н', () => {
    // 8В — верхняя, струны 6/5/4 на 8/10/10 (пример из ТЗ)
    expect(getChordShape('8В')).toEqual({ frets: [8, 10, 10, -1, -1, -1] });
    // 3В — как G5 на фото
    expect(getChordShape('3В')).toEqual({ frets: [3, 5, 5, -1, -1, -1] });
    // нижняя — та же форма на струну тоньше (5/4/3)
    expect(getChordShape('3Н')).toEqual({ frets: [-1, 3, 5, 5, -1, -1] });
    expect(getChordShape('1Н')).toEqual({ frets: [-1, 1, 3, 3, -1, -1] });
    // латинские двойники и регистр
    expect(getChordShape('4B')).toEqual({ frets: [4, 6, 6, -1, -1, -1] });
  });

  it('квинты по имени (A5, C5) — форма берётся автоматически', () => {
    // Корень до 5 лада — на 6-й струне
    expect(getChordShape('E5')).toEqual({ frets: [0, 2, 2, -1, -1, -1] });
    expect(getChordShape('G5')).toEqual({ frets: [3, 5, 5, -1, -1, -1] });
    expect(getChordShape('A5')).toEqual({ frets: [5, 7, 7, -1, -1, -1] });
    // Дальше — на 5-й
    expect(getChordShape('C5')).toEqual({ frets: [-1, 3, 5, 5, -1, -1] });
    expect(getChordShape('D5')).toEqual({ frets: [-1, 5, 7, 7, -1, -1] });
    // Бемоль и диез — одна и та же высота, одна и та же форма
    expect(getChordShape('A#5')).toEqual(getChordShape('Bb5'));
  });

  it('квинты рисуются точками, без баррэ', () => {
    expect(getChordShape('A5')?.barres).toBeUndefined();
    expect(getChordShape('C5')?.barres).toBeUndefined();
  });

  it('на укулеле квинт нет', () => {
    expect(getChordShape('A5', 'ukulele')).toBeNull();
  });

  it('без формы — null', () => {
    expect(getChordShape('Csus4')).toBeNull();
    expect(getChordShape('Xyz')).toBeNull();
  });
});

/**
 * Главная страховка миграции старых разборов: переименование «5В» → «A5» не
 * должно менять картинку. Правило выбора струны в `powerChordFrets` подобрано
 * именно под это, и таблица ниже — то, что не даст его случайно «улучшить».
 *
 * Позиции выше ходовых сюда не входят намеренно: «7Н» (E5 на 7 ладу) имя не
 * несёт, и генератор честно отдаёт открытую позицию. Такие места скрипт
 * миграции закрепляет аппликатурой на песне.
 */
describe('переименование квинт не меняет аппликатуру', () => {
  const same: [string, string][] = [
    ['3В', 'G5'],
    ['4В', 'G#5'],
    ['5В', 'A5'],
    ['1Н', 'A#5'],
    ['2Н', 'B5'],
    ['3Н', 'C5'],
    ['4Н', 'C#5'],
    ['5Н', 'D5'],
    ['6Н', 'D#5'],
  ];

  for (const [old, standard] of same) {
    it(`${old} → ${standard}`, () => {
      expect(powerFifthToChordName(old)).toBe(standard);
      expect(getChordShape(standard)).toEqual(getChordShape(old));
    });
  }
});

describe('powerFifthToChordName', () => {
  it('корень считается от открытой струны', () => {
    // Верхняя — от E (6-я струна), нижняя — от A (5-я)
    expect(powerFifthToChordName('5В')).toBe('A5');
    expect(powerFifthToChordName('7Н')).toBe('E5');
    // За пределами октавы имя повторяется: позиция в нём не живёт
    expect(powerFifthToChordName('17В')).toBe('A5');
  });

  it('написание ноты задаётся снаружи', () => {
    expect(powerFifthToChordName('1Н', 'sharp')).toBe('A#5');
    expect(powerFifthToChordName('1Н', 'flat')).toBe('Bb5');
  });

  it('латинские двойники и регистр', () => {
    expect(powerFifthToChordName('4B')).toBe('G#5');
    expect(powerFifthToChordName('4в')).toBe('G#5');
    expect(powerFifthToChordName('3H')).toBe('C5');
  });

  it('нулевой лад — открытая струна, а не мусор', () => {
    // Самые ходовые квинты вообще: открытая E и открытая A. Проверка
    // `fret < 1` их отбрасывала, и они оставались без аппликатуры.
    expect(powerFifthToChordName('0В')).toBe('E5');
    expect(powerFifthToChordName('0Н')).toBe('A5');
    expect(getChordShape('0В')).toEqual({ frets: [0, 2, 2, -1, -1, -1] });
    expect(getChordShape('0Н')).toEqual({ frets: [-1, 0, 2, 2, -1, -1] });
    // И совпадают с тем, что даёт стандартное имя
    expect(getChordShape('E5')).toEqual(getChordShape('0В'));
  });

  it('не такая запись — null', () => {
    expect(powerFifthToChordName('A5')).toBeNull();
    expect(powerFifthToChordName('Am')).toBeNull();
    expect(powerFifthToChordName('23В')).toBeNull();
    expect(parsePowerFifth('5X')).toBeNull();
  });
});

describe('parseChordDefs', () => {
  it('формы с чужим числом струн отбрасываются', () => {
    const json = JSON.stringify({ Am: [-1, 0, 2, 2, 1, 0], X: [0, 0, 0, 3] });
    // Шестиструнная форма подходит гитаре, четырёхструнная — укулеле.
    expect(Object.keys(parseChordDefs(json, 'guitar'))).toEqual(['Am']);
    expect(Object.keys(parseChordDefs(json, 'ukulele'))).toEqual(['X']);
  });

  it('формы с неигровым размахом отбрасываются', () => {
    // Нарисовать такую диаграмму нельзя (см. DIAGRAM_MAX_ROWS), а рукой её на
    // грифе не взять. Честнее показать «форма не задана», чем картинку с
    // молча пропавшим пальцем.
    const wide = JSON.stringify({ Wide: [1, -1, -1, -1, -1, 1 + DIAGRAM_MAX_ROWS] });
    expect(parseChordDefs(wide, 'guitar')).toEqual({});
  });

  it('форма ровно в потолок размаха проходит', () => {
    const edge = [1, -1, -1, -1, -1, DIAGRAM_MAX_ROWS];
    const json = JSON.stringify({ Edge: edge });
    expect(parseChordDefs(json, 'guitar')).toEqual({ Edge: { frets: edge } });
  });
});

describe('parseFrets', () => {
  it('компактный вид', () => {
    expect(parseFrets('x32010')).toEqual([-1, 3, 2, 0, 1, 0]);
  });
  it('через пробелы и -1', () => {
    expect(parseFrets('x 3 2 0 1 0')).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(parseFrets('-1 0 2 2 1 0')).toEqual([-1, 0, 2, 2, 1, 0]);
  });
  it('мусор → null', () => {
    expect(parseFrets('abc')).toBeNull();
    expect(parseFrets('x320')).toBeNull();
  });
});
