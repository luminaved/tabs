import { describe, expect, it } from 'vitest';
import {
  defsWithFretFifths,
  fretFifthNames,
  normalizePowerFifths,
  powerFifthPins,
  powerFifthRenames,
  songWithFretFifths,
} from './powerFifths';
import { parseSong } from './parse';
import { songFromRecord } from './fromRecord';
import { songAccidental, transposeSong } from './transform';
import { getChordShape, parseChordDefs, transposeChordDefs } from '../chords/diagrams';
import { chordsFromSong } from './usedChords';

describe('powerFifthRenames', () => {
  it('находит старую запись без повторов, в порядке появления', () => {
    const body = '[5В]сло[3Н]во\n[5В]ещё[7Н]раз';
    expect(powerFifthRenames(body)).toEqual([
      { from: '5В', to: 'A5' },
      { from: '3Н', to: 'C5' },
      { from: '7Н', to: 'E5' },
    ]);
  });

  it('обычные аккорды не трогает', () => {
    expect(powerFifthRenames('[Am]текст[C]ещё[F#m]')).toEqual([]);
    // Уже переведённые — тоже: предлагать нечего
    expect(powerFifthRenames('[A5]текст[C5]')).toEqual([]);
  });

  it('написание нот берётся из тональности песни', () => {
    expect(powerFifthRenames('[1Н]', 'Am')).toEqual([{ from: '1Н', to: 'A#5' }]);
    // Бемольная тональность — бемольное написание
    expect(powerFifthRenames('[1Н]', 'Dm')).toEqual([{ from: '1Н', to: 'Bb5' }]);
  });

  it('на укулеле подсказки нет — там таких квинт не играют', () => {
    expect(powerFifthRenames('[5В]текст', null, 'ukulele')).toEqual([]);
  });
});

describe('normalizePowerFifths', () => {
  it('переписывает только токены аккордов', () => {
    expect(normalizePowerFifths('[5В]сло[3Н]во')).toBe('[A5]сло[C5]во');
  });

  it('такой же текст в словах песни остаётся нетронутым', () => {
    // «5В» в тексте — это просто буквы, а не аккорд
    expect(normalizePowerFifths('[5В]играем 5В на шестой')).toBe('[A5]играем 5В на шестой');
  });

  it('пробелы внутри скобок не мешают', () => {
    expect(normalizePowerFifths('[ 5В ]слово')).toBe('[A5]слово');
  });

  it('директивы и серый текст не задеты', () => {
    const body = '{start_of_chorus}\n[5В]припев\n%проигрыш%\n{end_of_chorus}';
    expect(normalizePowerFifths(body)).toBe(
      '{start_of_chorus}\n[A5]припев\n%проигрыш%\n{end_of_chorus}',
    );
  });

  it('на укулеле текст не меняется', () => {
    expect(normalizePowerFifths('[5В]текст', null, 'ukulele')).toBe('[5В]текст');
  });

  it('после замены предлагать больше нечего', () => {
    const once = normalizePowerFifths('[5В]a[7Н]b', 'Am');
    expect(powerFifthRenames(once, 'Am')).toEqual([]);
  });
});

describe('powerFifthPins', () => {
  it('высокая позиция закрепляется — картинка не съезжает', () => {
    // «12В» — форма на 12 ладу, а имя ей достаётся «E5», у которого встроенная
    // форма стоит на открытых струнах. Ровно тот случай, ради которого всё и
    // написано: без закрепления разбор уехал бы на 12 ладов вниз.
    expect(powerFifthPins('[12В]слово', {})).toEqual({
      E5: { frets: [12, 14, 14, -1, -1, -1] },
    });
  });

  it('ходовые позиции не закрепляются — встроенная форма и так та же', () => {
    // 5В → A5 (5 лад шестой струны), 3Н → C5 (3 лад пятой). Обе встроенные
    // формы совпадают с записью, закреплять нечего.
    expect(powerFifthPins('[5В]a[3Н]b', {})).toEqual({});
  });

  it('своя форма переезжает со старого имени на новое', () => {
    const mine = { frets: [7, 9, 9, -1, -1, -1] };
    expect(powerFifthPins('[5В]слово', { '5В': mine })).toEqual({ A5: mine });
  });

  it('старый ключ убирается, даже когда закреплять нечего', () => {
    // Форма под «5В» совпадает со встроенной для A5 — закрепления не будет, но
    // и висеть под именем, которого в тексте больше нет, она не должна.
    const same = { frets: [5, 7, 7, -1, -1, -1] };
    expect(powerFifthPins('[5В]слово', { '5В': same })).toEqual({});
  });

  it('чужие аппликатуры не трогает', () => {
    const other = { frets: [-1, 0, 2, 2, 2, 0] };
    expect(powerFifthPins('[12В]a[Am]b', { Am: other })).toEqual({
      Am: other,
      E5: { frets: [12, 14, 14, -1, -1, -1] },
    });
  });

  it('уже заданную под новым именем форму не перебивает', () => {
    const mine = { frets: [0, 2, 2, -1, -1, -1] };
    expect(powerFifthPins('[12В]a[E5]b', { E5: mine })).toEqual({ E5: mine });
  });

  it('столкновение имён: побеждает первая по тексту позиция', () => {
    // 5В и 17В обе дают A5. Двух разных позиций одно имя не выражает, поэтому
    // закрепляется первая встреченная — редактор предупреждает об этом заранее.
    expect(powerFifthPins('[17В]a[5В]b', {})).toEqual({
      A5: { frets: [17, 19, 19, -1, -1, -1] },
    });
  });

  it('на укулеле набор аппликатур остаётся как был', () => {
    const defs = { '5В': { frets: [5, 7, 7, -1, -1, -1] } };
    expect(powerFifthPins('[5В]текст', defs, null, 'ukulele')).toBe(defs);
  });

  it('переименовывать нечего — набор возвращается тот же', () => {
    const defs = { Am: { frets: [-1, 0, 2, 2, 1, 0] } };
    expect(powerFifthPins('[Am]текст', defs)).toBe(defs);
  });

  it('написание нового имени берётся из тональности', () => {
    // 1Н → A#5 в диезной тональности и Bb5 в бемольной; позиция одна и та же.
    expect(Object.keys(powerFifthPins('[13Н]a', {}, 'Am'))).toEqual(['A#5']);
    expect(Object.keys(powerFifthPins('[13Н]a', {}, 'Dm'))).toEqual(['Bb5']);
  });
});

/**
 * Сборка читалки целиком — та же цепочка вызовов, что стоит в SongViewer.
 *
 * Отдельно от проверок самих функций: каждая по себе верна, а вопрос здесь
 * другой — в каком ПОРЯДКЕ их складывать. Ступени две, и обе обязательные:
 * сначала транспонирование (иначе «6В» перестала бы транспонироваться, то есть
 * вернулась бы та беда, из-за которой запись убрали из хранения), и только
 * потом подпись — потому что считается она по УЖЕ ГОТОВЫМ формам, вместе со
 * своими аппликатурами разбора. Разъехаться этому порядку в компоненте больше
 * нечем: он закреплён здесь.
 */
function viewerChain(
  body: string,
  key: string | null,
  defsJson: string | null,
  transpose: number,
  asFrets: boolean,
) {
  const base = songFromRecord({ body, key, title: 't' });
  const shapeSong = transposeSong(base, transpose);
  const shapeDefs = transposeChordDefs(
    parseChordDefs(defsJson, 'guitar'),
    transpose,
    songAccidental(base.meta.key, transpose),
  );
  const standard = chordsFromSong(shapeSong);
  const names = fretFifthNames(standard, 'guitar', shapeDefs);
  const on = asFrets && names.size > 0;
  const sheetDefs = on ? defsWithFretFifths(shapeDefs, names) : shapeDefs;
  const sheetSong = on ? songWithFretFifths(shapeSong, names) : shapeSong;
  const used = on ? standard.map((c) => names.get(c) ?? c) : standard;
  return {
    used,
    sheet: chordsFromSong(sheetSong),
    shapes: used.map((c) => getChordShape(c, 'guitar', sheetDefs)),
  };
}

/** Разбор с квинтами на всех трёх позициях струн плюс обычный аккорд. */
const BODY = '[E5]раз [C#5]два [G#5]три [A5]и [Am]обычный';

/** Своя форма A#5 с шестой струны — как она лежит в живых разборах. */
const MINE_A_SHARP = JSON.stringify({ 'A#5': [6, 8, 8, -1, -1, -1] });

describe('fretFifthNames', () => {
  it('подписывает по встроенным формам, когда своих нет', () => {
    const names = fretFifthNames(['E5', 'C#5', 'G#5', 'A5', 'Am'], 'guitar', {});
    expect([...names]).toEqual([
      ['E5', '0В'],
      ['C#5', '4Н'],
      ['G#5', '4В'],
      ['A5', '5В'],
    ]);
  });

  it('СВОЯ форма перебивает встроенную — подпись идёт за картинкой', () => {
    // Тот самый баг: у A#5 встроенная форма стоит на пятой струне на первом
    // ладу («1Н»), а нарисованная руками — на шестой на шестом. Подпись,
    // посчитанная от ИМЕНИ аккорда, говорила «1Н» под диаграммой шестого лада.
    const mine = parseChordDefs(MINE_A_SHARP, 'guitar');
    expect(fretFifthNames(['A#5'], 'guitar', mine).get('A#5')).toBe('6В');
    // Без своей формы у того же имени подпись прежняя — это её настоящее место.
    expect(fretFifthNames(['A#5'], 'guitar', {}).get('A#5')).toBe('1Н');
  });

  it('форму, которую записью не выразить, не подписываем вовсе', () => {
    // Корень с четвёртой струны: у записи есть только В (шестая) и Н (пятая).
    const odd = parseChordDefs(JSON.stringify({ 'A#5': [-1, -1, 8, 10, 10, -1] }), 'guitar');
    expect(fretFifthNames(['A#5'], 'guitar', odd).has('A#5')).toBe(false);
    // Непривычный хват — тоже: врать про него нельзя.
    const weird = parseChordDefs(JSON.stringify({ E5: [-1, 2, 2, 4, -1, -1] }), 'guitar');
    expect(fretFifthNames(['E5'], 'guitar', weird).has('E5')).toBe(false);
  });

  it('одну подпись двум аккордам не отдаём', () => {
    // Две разные квинты, нарисованные в одном месте грифа: второй достаётся
    // стандартное имя, иначе в тексте они стали бы неразличимы.
    const clash = parseChordDefs(
      JSON.stringify({ 'A#5': [6, 8, 8, -1, -1, -1], B5: [6, 8, 8, -1, -1, -1] }),
      'guitar',
    );
    const names = fretFifthNames(['A#5', 'B5'], 'guitar', clash);
    expect(names.get('A#5')).toBe('6В');
    expect(names.has('B5')).toBe(false);
  });

  it('на укулеле не подписывает ничего', () => {
    expect(fretFifthNames(['A5', 'C5'], 'ukulele', {}).size).toBe(0);
  });
});

describe('songWithFretFifths / defsWithFretFifths', () => {
  const names = new Map([
    ['G#5', '4В'],
    ['C5', '3Н'],
  ]);

  it('подписывает квинты, не трогая остальные аккорды', () => {
    const song = parseSong('[G#5]сло[Am]во [C5]ещё[F]раз');
    expect(chordsFromSong(songWithFretFifths(song, names))).toEqual(['4В', 'Am', '3Н', 'F']);
  });

  it('подписывать нечего — возвращается ТОТ ЖЕ объект', () => {
    // На этом держится память рендера: лист не перерисовывается там, где
    // ничего не менялось.
    const song = parseSong('[Am]сло[F]во');
    expect(songWithFretFifths(song, names)).toBe(song);
    expect(songWithFretFifths(song, new Map())).toBe(song);
  });

  it('переносит свою форму под новую подпись', () => {
    const shape = { frets: [4, 6, 6, -1, -1, -1] };
    const am = { frets: [-1, 0, 2, 2, 1, 0] };
    expect(defsWithFretFifths({ 'G#5': shape, Am: am }, names)).toEqual({ '4В': shape, Am: am });
  });

  it('переносить нечего — ТОТ ЖЕ объект', () => {
    const defs = { Am: { frets: [-1, 0, 2, 2, 1, 0] } };
    expect(defsWithFretFifths(defs, names)).toBe(defs);
    expect(defsWithFretFifths(defs, new Map())).toBe(defs);
  });
});

describe('запись квинт в читалке', () => {
  it('без переключателя — стандартные имена', () => {
    expect(viewerChain(BODY, null, null, 0, false).used).toEqual([
      'E5',
      'C#5',
      'G#5',
      'A5',
      'Am',
    ]);
  });

  it('с переключателем — лады, обычный аккорд не тронут', () => {
    expect(viewerChain(BODY, null, null, 0, true).used).toEqual([
      '0В',
      '4Н',
      '4В',
      '5В',
      'Am',
    ]);
  });

  it('панель аккордов и текст подписаны одинаково', () => {
    const v = viewerChain(BODY, null, null, 0, true);
    expect(v.used).toEqual(v.sheet);
  });

  it('аппликатуры совпадают до последнего лада', () => {
    expect(viewerChain(BODY, null, null, 0, true).shapes).toEqual(
      viewerChain(BODY, null, null, 0, false).shapes,
    );
  });

  it('и после транспонирования тоже — на всех сдвигах', () => {
    for (let t = -11; t <= 11; t++) {
      const off = viewerChain(BODY, 'Am', null, t, false);
      const on = viewerChain(BODY, 'Am', null, t, true);
      expect(on.shapes, `сдвиг ${t}`).toEqual(off.shapes);
      expect(on.used, `сдвиг ${t}`).toHaveLength(off.used.length);
      expect(on.used, `сдвиг ${t}`).toEqual(on.sheet);
    }
  });

  it('со своей аппликатурой подпись идёт за картинкой, и картинка не двигается', () => {
    // Разбор «я схавал опиат» из базы: A#5 нарисован на шестой струне.
    const off = viewerChain('[A#5]раз', null, MINE_A_SHARP, 0, false);
    const on = viewerChain('[A#5]раз', null, MINE_A_SHARP, 0, true);
    expect(on.used).toEqual(['6В']);
    expect(on.shapes).toEqual(off.shapes);
    expect(on.shapes[0]).toEqual({ frets: [6, 8, 8, -1, -1, -1] });
  });

  it('и со своей аппликатурой после транспонирования', () => {
    for (let t = -5; t <= 5; t++) {
      const off = viewerChain('[A#5]раз [Am]два', null, MINE_A_SHARP, t, false);
      const on = viewerChain('[A#5]раз [Am]два', null, MINE_A_SHARP, t, true);
      expect(on.shapes, `сдвиг ${t}`).toEqual(off.shapes);
      expect(on.used, `сдвиг ${t}`).toEqual(on.sheet);
    }
  });
});
