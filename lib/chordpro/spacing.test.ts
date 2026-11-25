import { describe, expect, it } from 'vitest';
import { chordPads, textWidthEm } from './spacing';
import { lineToColumns } from './columns';
import { parseLyricLine } from './parse';

// Из сырой строки ChordPro сразу в отступы колонок.
const pads = (raw: string) => chordPads(lineToColumns(parseLyricLine(raw)));

/**
 * Во что выражение превращается на странице песни: кегль аккорда там
 * дефолтный, 0.72em. Отступ на других кеглях досчитывает браузер — за это и
 * отвечает `calc()` с переменной.
 */
const padEm = (expr: string | undefined): number => {
  if (!expr) return 0;
  const m = expr.match(
    /^max\(0em, calc\(([\d.]+) \* var\(--sheet-chord-size, ([\d.]+)em\) ([-+]) ([\d.]+)em\)\)$/,
  );
  if (!m) throw new Error(`неожиданный формат отступа: ${expr}`);
  return Math.max(0, Number(m[1]) * Number(m[2]) + (m[3] === '-' ? -1 : 1) * Number(m[4]));
};

const padsEm = (raw: string) => pads(raw).map(padEm);

describe('textWidthEm', () => {
  it('пустая строка — ноль', () => {
    expect(textWidthEm('')).toBe(0);
  });

  it('широкие буквы шире узких', () => {
    expect(textWidthEm('ш')).toBeGreaterThan(textWidthEm('т'));
  });
});

describe('chordPads', () => {
  it('до следующего аккорда далеко — текст не раздвигается', () => {
    // Ради «D#5» над «В» раньше растягивалась вся колонка, хотя до «B5»
    // оставалось полстроки свободного места.
    expect(padsEm('[D#5]В моей голове бар[B5]дак')).toEqual([0, 0, 0, 0, 0]);
  });

  it('строка без аккордов — без отступов', () => {
    expect(pads('обычный текст без аккордов')).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('аккорды впритык — место добавляется перед следующим', () => {
    const [first, second] = padsEm('[Am]я [C]о');
    expect(first).toBeGreaterThan(0);
    // Последнему аккорду в строке хватает своего слова.
    expect(second).toBe(0);
  });

  it('отступ уходит в пробел, а не внутрь слова', () => {
    // Слово «хоть» разорвано аккордом; двигать надо слово целиком, поэтому
    // место добавляется после «я», а не между «х» и «оть».
    const [before, inside] = padsEm('[D#5]я х[B5]оть');
    expect(before).toBeGreaterThan(0);
    expect(inside).toBe(0);
  });

  it('внутри слова пробела нет — отступ приходится на слог', () => {
    const [syllable, rest] = padsEm('[D#5]сл[B5]ово');
    expect(syllable).toBeGreaterThan(0);
    expect(rest).toBe(0);
  });

  it('аккорд над коротким словом в конце строки не вылезает за него', () => {
    const [, last] = padsEm('текст [D#5]я');
    expect(last).toBeGreaterThan(0);
  });

  it('чем шире имя аккорда, тем больше отступ', () => {
    expect(padsEm('[D#5]я [B5]о')[0]).toBeGreaterThan(padsEm('[C]я [B5]о')[0]);
  });
});
