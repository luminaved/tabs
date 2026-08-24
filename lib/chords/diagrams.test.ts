import { describe, expect, it } from 'vitest';
import { transposeChord } from './chord';
import { pcToName } from './pitch';
import {
  DIAGRAM_MAX_ROWS,
  DIAGRAM_MIN_ROWS,
  EDITOR_FRET_ROWS,
  fretSpan,
  fretWindow,
  chordNameToPowerFifth,
  getChordShape,
  parseChordDefs,
  parseFrets,
  parsePowerFifth,
  powerFifthToChordName,
  transposeChordDefs,
  transposeShape,
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

  it('на укулеле у квинты своя форма, не гитарная', () => {
    // Раньше здесь стояло «на укулеле квинт нет», и это была не оговорка в
    // тесте, а поведение: A5 на укулеле не рисовался вовсе. Форму приходилось
    // задавать руками каждому такому аккорду — а при транспонировании она
    // пропадала вместе со старым именем.
    expect(getChordShape('A5', 'ukulele')?.frets).toEqual([2, 4, 0, 0]);
    expect(getChordShape('A5', 'guitar')?.frets).toEqual([5, 7, 7, -1, -1, -1]);
  });

  it('без формы — null', () => {
    expect(getChordShape('Csus4')).toBeNull();
    expect(getChordShape('Xyz')).toBeNull();
  });
});

/**
 * Главная страховка миграции старых разборов: переименование «5В» → «A5» не
 * должно менять картинку. Правило выбора струны в `guitarPowerChord` (instruments.ts) подобрано
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

describe('transposeShape', () => {
  it('форма без открытых струн едет по грифу вместе с песней', () => {
    expect(transposeShape({ frets: [-1, 2, 4, 4, 3, 2] }, 2)).toEqual({
      frets: [-1, 4, 6, 6, 5, 4],
    });
  });

  it('баррэ едет вместе с формой', () => {
    expect(
      transposeShape({ frets: [1, 3, 3, 2, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] }, 3),
    ).toEqual({ frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }] });
  });

  it('форма с открытой струной не едет — её двигать нельзя', () => {
    // Открытая струна звучит своей нотой независимо от того, куда переехала
    // рука: сдвинутый C дал бы не D, а созвучие ни на что не похожее.
    expect(transposeShape({ frets: [-1, 3, 2, 0, 1, 0] }, 2)).toBeNull();
  });

  it('нулевой сдвиг возвращает ту же форму', () => {
    const shape = { frets: [-1, 3, 2, 0, 1, 0] };
    expect(transposeShape(shape, 0)).toBe(shape);
  });

  it('уехавшая за гриф форма возвращается октавой ниже', () => {
    // Bm с 10 лада + 4 = 14-й, играть неудобно; та же форма на 2-м звучит тем
    // же аккордом.
    expect(transposeShape({ frets: [-1, 10, 12, 12, 11, 10] }, 4)?.frets).toEqual([
      -1, 2, 4, 4, 3, 2,
    ]);
  });

  it('сдвиг вниз за порожек — октавой выше', () => {
    expect(transposeShape({ frets: [-1, 2, 4, 4, 3, 2] }, -4)?.frets).toEqual([
      -1, 10, 12, 12, 11, 10,
    ]);
  });

  it('форма, которой не хватает грифа ни в одной октаве, не отдаётся', () => {
    // D5 на укулеле (баррэ на 2 ладу, точки на 5-м) плюс восемь полутонов —
    // это 10 и 13 лады, а октавой ниже упирается в порожек. Пусть лучше
    // возьмут встроенную: она посчитана для нового имени и лежит внизу.
    expect(transposeShape({ frets: [2, 2, 5, 5] }, 8)).toBeNull();
  });
});

describe('transposeChordDefs', () => {
  const uke = 'ukulele';

  it('своя форма переезжает под новое имя аккорда', () => {
    // Ровно тот случай, ради которого всё написано: разбор для укулеле, где
    // квинты нарисованы руками. До этого при нажатии «+» диаграмма исчезала.
    const defs = { D5: { frets: [2, 2, 5, 5], barres: [{ fret: 2, from: 0, to: 3 }] } };
    expect(transposeChordDefs(defs, 1, 'sharp')).toEqual({
      'D#5': { frets: [3, 3, 6, 6], barres: [{ fret: 3, from: 0, to: 3 }] },
    });
  });

  it('написание нот берётся из целевой тональности', () => {
    const defs = { A5: { frets: [4, -1, 2, 2] } };
    expect(Object.keys(transposeChordDefs(defs, 1, 'flat'))).toEqual(['Bb5']);
    expect(Object.keys(transposeChordDefs(defs, 1, 'sharp'))).toEqual(['A#5']);
  });

  it('форма с открытой струной отдаётся встроенной', () => {
    // Своей формы у нового имени не остаётся — и это правильно: её место
    // занимает встроенная, посчитанная для нужной высоты.
    const defs = { C5: { frets: [0, 0, 3, 3] } };
    expect(transposeChordDefs(defs, 2, 'sharp')).toEqual({});
    expect(getChordShape('D5', uke, {})?.frets).toEqual([2, 2, 5, 5]);
  });

  it('не-аккорд остаётся под своим именем', () => {
    // «5В» в тексте песни тоже не транспонируется (разбор ждёт корень A-G),
    // поэтому и форма обязана остаться на месте — иначе она потерялась бы.
    const defs = { '5В': { frets: [5, 7, 7, -1, -1, -1] } };
    expect(transposeChordDefs(defs, 3, 'sharp')).toEqual(defs);
  });

  it('нулевой сдвиг ничего не трогает', () => {
    const defs = { D5: { frets: [2, 2, 5, 5] } };
    expect(transposeChordDefs(defs, 0, 'sharp')).toBe(defs);
  });

  it('разбор на квинтах не теряет аппликатур ни на одном сдвиге', () => {
    // Формы и аккорды — из настоящего разбора для укулеле, где все четыре
    // квинты были нарисованы руками (встроенных на укулеле тогда не было).
    // Ровно эта песня и показывала баг: «+» стирал все диаграммы разом.
    // Проверяем весь диапазон, который даёт кнопка (см. SongViewer): часть
    // форм переезжает вместе с песней, часть уступает встроенным, но пустой
    // карточки не остаётся ни на одном полутоне.
    const defs = parseChordDefs(
      JSON.stringify({
        B5: { frets: [4, -1, 2, 2] },
        G5: { frets: [0, 2, 3, 5] },
        D5: { frets: [2, 2, 5, 5], barres: [{ fret: 2, from: 0, to: 3 }] },
        A5: { frets: [2, 4, 0, 0] },
      }),
      'ukulele',
    );

    for (let n = -11; n <= 11; n++) {
      const moved = transposeChordDefs(defs, n, 'sharp');
      for (const c of ['B5', 'G5', 'D5', 'A5']) {
        const name = transposeChord(c, n, 'sharp');
        const shape = getChordShape(name, 'ukulele', moved);
        expect(shape, `${c} → ${name} (сдвиг ${n})`).not.toBeNull();
        expect(Math.max(...shape!.frets), `${name} [${shape!.frets}]: за гриф`).toBeLessThanOrEqual(
          12,
        );
      }
    }
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

describe('имена аккордов из прототипа', () => {
  // В аккорды попадает всё, что стоит в квадратных скобках (chordsInOrder не
  // проверяет содержимое), а таблицы форм — обычные объектные литералы.
  // Поэтому такое имя приносило из прототипа истинное значение вместо формы,
  // и на нём падал deriveBarres — вместе с редактором и страницей разбора.
  const PROTO = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

  it('во встроенных таблицах ничего не находят', () => {
    for (const name of PROTO) {
      expect(getChordShape(name, 'guitar'), name).toBeNull();
      expect(getChordShape(name, 'ukulele'), name).toBeNull();
    }
  });

  it('в своих аппликатурах ничего не находят', () => {
    const defs = parseChordDefs(JSON.stringify({ Am: [-1, 0, 2, 2, 1, 0] }), 'guitar');
    for (const name of PROTO) {
      expect(getChordShape(name, 'guitar', defs), name).toBeNull();
    }
  });

  it('корень с таким суффиксом не уходит в таблицу подвижных форм', () => {
    // «Aconstructor» разбирался: корень A, суффикс «constructor» — и суффикс
    // приносил из прототипа `Object` вместо функции, строящей форму.
    for (const name of PROTO) {
      expect(getChordShape(`A${name}`, 'guitar'), name).toBeNull();
    }
  });

  it('своя форма под таким именем всё же находится', () => {
    // Обратная сторона: если человек НАРИСОВАЛ форму для аккорда с таким
    // именем, она его собственное свойство и работать обязана.
    const frets = [-1, 0, 2, 2, 1, 0];
    const defs = parseChordDefs(JSON.stringify({ constructor: frets }), 'guitar');
    expect(getChordShape('constructor', 'guitar', defs)).toEqual({ frets });
  });
});

describe('chordNameToPowerFifth', () => {
  it('переводит квинту в запись «лад + В/Н»', () => {
    expect(chordNameToPowerFifth('G#5')).toBe('4В');
    expect(chordNameToPowerFifth('A5')).toBe('5В');
    expect(chordNameToPowerFifth('E5')).toBe('0В');
    expect(chordNameToPowerFifth('C5')).toBe('3Н');
    expect(chordNameToPowerFifth('D5')).toBe('5Н');
  });

  it('не квинта — null, переводить нечего', () => {
    for (const name of ['Am', 'C', 'G7', 'A5/E', 'N.C.', '5В', '', 'H5', 'A']) {
      expect(chordNameToPowerFifth(name), name).toBeNull();
    }
  });

  it('на всех двенадцати высотах перевод возвращается к тому же имени', () => {
    for (let pc = 0; pc < 12; pc++) {
      const name = `${pcToName(pc, 'sharp')}5`;
      const frets = chordNameToPowerFifth(name);
      expect(frets, name).not.toBeNull();
      expect(powerFifthToChordName(frets as string), name).toBe(name);
    }
  });

  it('от смены записи АППЛИКАТУРА НЕ ДВИГАЕТСЯ', () => {
    // Главное свойство переключателя в читалке: он меняет подпись, а не аккорд.
    // Держится на том, что струну обе стороны выбирают одним порогом
    // (GUITAR_FIFTH_ON_SIXTH_MAX). Разойдись они — человек, нажавший
    // «4В», получил бы вместо своего разбора другой, на несколько ладов в
    // сторону, и заметил бы это только на слух.
    for (let pc = 0; pc < 12; pc++) {
      const name = `${pcToName(pc, 'sharp')}5`;
      const frets = chordNameToPowerFifth(name) as string;
      expect(getChordShape(frets, 'guitar'), `${name} → ${frets}`).toEqual(
        getChordShape(name, 'guitar'),
      );
    }
  });

  it('подпись всегда двухсимвольная — ширина кнопки не прыгает', () => {
    for (let pc = 0; pc < 12; pc++) {
      const frets = chordNameToPowerFifth(`${pcToName(pc, 'sharp')}5`) as string;
      expect(frets, frets).toHaveLength(2);
    }
  });
});
