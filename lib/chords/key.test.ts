import { describe, expect, it } from 'vitest';
import { accidentalForKey, diatonicChords, parseKey, transposeKey } from './key';

describe('parseKey', () => {
  it('мажор и минор', () => {
    expect(parseKey('C')).toMatchObject({ tonicPc: 0, minor: false });
    expect(parseKey('Am')).toMatchObject({ tonicPc: 9, minor: true });
    expect(parseKey('Bb')).toMatchObject({ tonicPc: 10, minor: false });
    expect(parseKey('F#m')).toMatchObject({ tonicPc: 6, minor: true });
    expect(parseKey('Cminor')).toMatchObject({ tonicPc: 0, minor: true });
  });
  it('мусор → null', () => {
    expect(parseKey('H')).toBeNull();
    expect(parseKey('xyz')).toBeNull();
  });
});

describe('accidentalForKey', () => {
  it('знак в названии имеет приоритет', () => {
    expect(accidentalForKey('Bb')).toBe('flat');
    expect(accidentalForKey('F#')).toBe('sharp');
    expect(accidentalForKey('Ebm')).toBe('flat');
    expect(accidentalForKey('C#m')).toBe('sharp');
  });
  it('натуральные тональности по кругу квинт', () => {
    expect(accidentalForKey('C')).toBe('sharp');
    expect(accidentalForKey('G')).toBe('sharp');
    expect(accidentalForKey('F')).toBe('flat'); // единственный бемольный натуральный мажор
    expect(accidentalForKey('D')).toBe('sharp');
  });
  it('натуральные минорные', () => {
    expect(accidentalForKey('Am')).toBe('sharp');
    expect(accidentalForKey('Em')).toBe('sharp');
    expect(accidentalForKey('Dm')).toBe('flat');
    expect(accidentalForKey('Gm')).toBe('flat');
    expect(accidentalForKey('Cm')).toBe('flat');
    expect(accidentalForKey('Fm')).toBe('flat');
  });
});

describe('transposeKey', () => {
  it('A-мажор + 1 полутон → Bb-мажор (не A#)', () => {
    expect(transposeKey('A', 1)).toBe('Bb');
  });
  it('целевая тональность даёт согласованное написание', () => {
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('Bb', 2)).toBe('C');
    expect(transposeKey('G', -1)).toBe('Gb');
    expect(transposeKey('Am', 3)).toBe('Cm');
    expect(transposeKey('Em', -2)).toBe('Dm');
  });
  it('относительный минор мажора берёт то же написание', () => {
    // Gb-мажор (бемоль) ↔ Ebm (бемоль)
    expect(transposeKey('C', 6)).toBe('Gb');
    expect(transposeKey('Am', 6)).toBe('Ebm');
  });
});

describe('diatonicChords', () => {
  it('мажор', () => {
    expect(diatonicChords('C')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(diatonicChords('G')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']);
  });
  it('минор', () => {
    expect(diatonicChords('Am')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  });
  it('написание следует за тональностью', () => {
    expect(diatonicChords('F')).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
  });
  it('неизвестная тональность → пусто', () => {
    expect(diatonicChords('')).toEqual([]);
    expect(diatonicChords('xyz')).toEqual([]);
  });
});

// Тест `capoShapeShift` удалён вместе с самой функцией — почему именно,
// написано на её месте в key.ts. Коротко: она считала сдвиг от исходных
// аккордов, а на странице имена уже транспонированы, и её подключение дало бы
// двойной сдвиг.
