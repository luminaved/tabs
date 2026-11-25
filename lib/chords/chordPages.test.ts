import { describe, expect, it } from 'vitest';
import { chordFromSlug, chordSlug, isPowerChordName } from './chordPages';

describe('chordSlug', () => {
  it('без знака подпись слитная', () => {
    expect(chordSlug('Am')).toBe('am');
    expect(chordSlug('C')).toBe('c');
    expect(chordSlug('A5')).toBe('a5');
    expect(chordSlug('Fmaj7')).toBe('fmaj7');
    expect(chordSlug('Gsus')).toBe('gsus');
  });

  it('знак альтерации пишется словом', () => {
    // Диез в адрес голым не поставить: «#» начинает якорь, и «/chords/A#5»
    // браузер обрезал бы до «/chords/A».
    expect(chordSlug('A#5')).toBe('a-sharp-5');
    expect(chordSlug('F#m')).toBe('f-sharp-m');
    expect(chordSlug('C#m7')).toBe('c-sharp-m7');
    expect(chordSlug('Bb')).toBe('b-flat');
    expect(chordSlug('Bb5')).toBe('b-flat-5');
  });

  it('голая си остаётся си, а не превращается в бемоль', () => {
    // Замена всех «b» подряд ломала именно этот случай: «B» становилось «-flat».
    expect(chordSlug('B')).toBe('b');
    expect(chordSlug('B5')).toBe('b5');
    expect(chordSlug('Bm')).toBe('bm');
    expect(chordSlug('B7')).toBe('b7');
  });

  it('буква b в суффиксе качества — не знак альтерации', () => {
    // «m7b5» — это уменьшённая квинта, а не бемоль у корня.
    expect(chordSlug('Cm7b5')).toBe('cm7b5');
    expect(chordSlug('G7b9')).toBe('g7b9');
  });

  it('подписи разных аккордов не совпадают', () => {
    const names = ['A', 'A5', 'Am', 'A#', 'A#5', 'A#m', 'Ab', 'B', 'Bb', 'Bb5', 'Bm', 'C#m7', 'Cm7b5'];
    const slugs = names.map(chordSlug);
    expect(new Set(slugs).size).toBe(names.length);
  });

  it('подпись не содержит того, что ломает адрес', () => {
    for (const name of ['A#5', 'Cm7b5', 'C/G', 'F#sus4', 'Bb']) {
      expect(chordSlug(name), name).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('chordFromSlug', () => {
  const known = ['Am', 'A#5', 'Bb', 'B', 'F#m'];

  it('находит аккорд по его подписи', () => {
    expect(chordFromSlug('am', known)).toBe('Am');
    expect(chordFromSlug('a-sharp-5', known)).toBe('A#5');
    expect(chordFromSlug('b-flat', known)).toBe('Bb');
    expect(chordFromSlug('b', known)).toBe('B');
  });

  it('регистр в адресе не мешает', () => {
    expect(chordFromSlug('A-Sharp-5', known)).toBe('A#5');
  });

  it('незнакомая подпись — null, страницы не будет', () => {
    // Страницы заводятся только для аккордов, которые в каталоге правда есть:
    // иначе это дорвей, на котором показать нечего.
    expect(chordFromSlug('z-sharp-9', known)).toBeNull();
    expect(chordFromSlug('', known)).toBeNull();
    expect(chordFromSlug('gsus', known)).toBeNull();
  });
});

describe('isPowerChordName', () => {
  it('квинты опознаются', () => {
    expect(isPowerChordName('A5')).toBe(true);
    expect(isPowerChordName('F#5')).toBe(true);
    expect(isPowerChordName('Bb5')).toBe(true);
  });

  it('прочее — нет', () => {
    for (const name of ['Am', 'C', 'Cmaj7', 'A55', 'A5sus', '5В', '']) {
      expect(isPowerChordName(name), name).toBe(false);
    }
  });
});
