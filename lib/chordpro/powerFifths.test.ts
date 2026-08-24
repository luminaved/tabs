import { describe, expect, it } from 'vitest';
import {
  defsWithFretFifths,
  normalizePowerFifths,
  powerFifthPins,
  powerFifthRenames,
  songWithFretFifths,
} from './powerFifths';
import { parseSong } from './parse';
import { songFromRecord } from './fromRecord';
import { songAccidental, transposeSong } from './transform';
import {
  chordNameToPowerFifth,
  getChordShape,
  parseChordDefs,
  transposeChordDefs,
} from '../chords/diagrams';
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

describe('songWithFretFifths', () => {
  it('подписывает квинты ладами, не трогая остальные аккорды', () => {
    const song = parseSong('[G#5]сло[Am]во [C5]ещё[F]раз');
    expect(chordsFromSong(songWithFretFifths(song))).toEqual(['4В', 'Am', '3Н', 'F']);
  });

  it('подписывать нечего — возвращается ТОТ ЖЕ объект', () => {
    // На этом держится память рендера: лист не перерисовывается там, где
    // ничего не менялось.
    const song = parseSong('[Am]сло[F]во');
    expect(songWithFretFifths(song)).toBe(song);
  });

  it('устаревшую запись оставляет как есть — она уже такая', () => {
    const song = parseSong('[5В]сло[3Н]во');
    expect(songWithFretFifths(song)).toBe(song);
  });

  it('число аккордов и их порядок сохраняются', () => {
    // Перевод взаимно однозначен на двенадцати высотах, поэтому две разные
    // квинты не могут схлопнуться в одну подпись.
    const song = parseSong('[C5]а[D5]б[E5]в[F5]г[G5]д[A5]е[B5]ж');
    const before = chordsFromSong(song);
    const after = chordsFromSong(songWithFretFifths(song));
    expect(after).toHaveLength(before.length);
    expect(new Set(after).size).toBe(before.length);
  });
});

describe('defsWithFretFifths', () => {
  it('переносит свою форму под новую подпись', () => {
    const shape = { frets: [4, 6, 6, -1, -1, -1] };
    expect(defsWithFretFifths({ 'G#5': shape })).toEqual({ '4В': shape });
  });

  it('не-квинты остаются под своими именами', () => {
    const am = { frets: [-1, 0, 2, 2, 1, 0] };
    const g = { frets: [4, 6, 6, -1, -1, -1] };
    expect(defsWithFretFifths({ Am: am, 'G#5': g })).toEqual({ Am: am, '4В': g });
  });

  it('переносить нечего — ТОТ ЖЕ объект', () => {
    const defs = { Am: { frets: [-1, 0, 2, 2, 1, 0] } };
    expect(defsWithFretFifths(defs)).toBe(defs);
  });
});

/**
 * Сборка читалки целиком — та же цепочка вызовов, что стоит в SongViewer.
 *
 * Отдельно от проверок самих функций: каждая из них по себе верна, а вопрос
 * здесь другой — в каком ПОРЯДКЕ их складывать. Сначала транспонирование,
 * потом подпись: наоборот запись «4В» перестала бы транспонироваться, то есть
 * вернулась бы ровно та беда, из-за которой её убрали из хранения. Разъехаться
 * этому порядку в компоненте больше нечем — он закреплён здесь.
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
  const sheetDefs = asFrets ? defsWithFretFifths(shapeDefs) : shapeDefs;
  const sheetSong = asFrets ? songWithFretFifths(shapeSong) : shapeSong;
  const standard = chordsFromSong(shapeSong);
  const used = asFrets ? standard.map((c) => chordNameToPowerFifth(c) ?? c) : standard;
  return {
    used,
    sheet: chordsFromSong(sheetSong),
    shapes: used.map((c) => getChordShape(c, 'guitar', sheetDefs)),
  };
}

/** Разбор с квинтами на всех трёх позициях струн плюс обычный аккорд. */
const BODY = '[E5]раз [C#5]два [G#5]три [A5]и [Am]обычный';

describe('запись квинт в читалке', () => {
  it('без переключателя — стандартные имена', () => {
    expect(viewerChain(BODY, null, null, 0, false).used).toEqual(['E5','C#5','G#5','A5','Am']);
  });

  it('с переключателем — лады, обычный аккорд не тронут', () => {
    expect(viewerChain(BODY, null, null, 0, true).used).toEqual(['0В','4Н','4В','5В','Am']);
  });

  it('панель аккордов и текст подписаны одинаково', () => {
    const v = viewerChain(BODY, null, null, 0, true);
    expect(v.used).toEqual(v.sheet);
  });

  it('аппликатуры совпадают до последнего лада', () => {
    expect(viewerChain(BODY, null, null, 0, true).shapes).toEqual(viewerChain(BODY, null, null, 0, false).shapes);
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

  it('своя аппликатура переезжает вместе с подписью', () => {
    const mine = JSON.stringify({ 'G#5': [9, 11, 11, -1, -1, -1] });
    const on = viewerChain(BODY, null, mine, 0, true);
    expect(on.shapes[on.used.indexOf('4В')]).toEqual({ frets: [9, 11, 11, -1, -1, -1] });
  });
});
