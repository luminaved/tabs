import { describe, expect, it } from 'vitest';
import { formatChord, parseChord, transposeChord } from './chord';

describe('parseChord', () => {
  it('простые мажор и минор', () => {
    expect(parseChord('C')).toEqual({ rootPc: 0, quality: '', bassPc: null });
    expect(parseChord('Am')).toEqual({ rootPc: 9, quality: 'm', bassPc: null });
  });

  it('сложные суффиксы сохраняются целиком', () => {
    expect(parseChord('Cmaj7')).toEqual({ rootPc: 0, quality: 'maj7', bassPc: null });
    expect(parseChord('Am7b5')).toEqual({ rootPc: 9, quality: 'm7b5', bassPc: null });
    expect(parseChord('Bsus4')).toEqual({ rootPc: 11, quality: 'sus4', bassPc: null });
    expect(parseChord('C7#9')).toEqual({ rootPc: 0, quality: '7#9', bassPc: null });
  });

  it('slash-аккорды: корень, качество и бас', () => {
    expect(parseChord('F#m7/C#')).toEqual({ rootPc: 6, quality: 'm7', bassPc: 1 });
    expect(parseChord('C/E')).toEqual({ rootPc: 0, quality: '', bassPc: 4 });
    expect(parseChord('D/F#')).toEqual({ rootPc: 2, quality: '', bassPc: 6 });
  });

  it('корень с бемолем не путается с суффиксом', () => {
    expect(parseChord('Bb')).toEqual({ rootPc: 10, quality: '', bassPc: null });
    expect(parseChord('Bbm')).toEqual({ rootPc: 10, quality: 'm', bassPc: null });
    expect(parseChord('Abmaj7')).toEqual({ rootPc: 8, quality: 'maj7', bassPc: null });
  });

  it('не-аккорды дают null', () => {
    expect(parseChord('N.C.')).toBeNull();
    expect(parseChord('%')).toBeNull();
    expect(parseChord('')).toBeNull();
    expect(parseChord('Hmm')).toBeNull();
  });
});

describe('formatChord', () => {
  it('уважает выбор диез/бемоль', () => {
    const c = { rootPc: 10, quality: 'm7', bassPc: 3 };
    expect(formatChord(c, 'sharp')).toBe('A#m7/D#');
    expect(formatChord(c, 'flat')).toBe('Bbm7/Eb');
  });
});

describe('transposeChord', () => {
  it('транспонирует корень и бас, сохраняя качество', () => {
    expect(transposeChord('Cmaj7', 2, 'sharp')).toBe('Dmaj7');
    expect(transposeChord('Am7b5', 3, 'flat')).toBe('Cm7b5');
    expect(transposeChord('F#m7/C#', 1, 'sharp')).toBe('Gm7/D');
  });

  it('обрабатывает отрицательный сдвиг и перенос через октаву', () => {
    expect(transposeChord('Bsus4', -1, 'sharp')).toBe('A#sus4');
    expect(transposeChord('Bsus4', -1, 'flat')).toBe('Bbsus4');
    expect(transposeChord('C', -1, 'flat')).toBe('B');
  });

  it('не-аккорды проходят без изменений', () => {
    expect(transposeChord('N.C.', 5, 'sharp')).toBe('N.C.');
    expect(transposeChord('%', 2, 'flat')).toBe('%');
  });

  it('сдвиг 0 возвращает нормализованное написание', () => {
    expect(transposeChord('Bb', 0, 'flat')).toBe('Bb');
    expect(transposeChord('Bb', 0, 'sharp')).toBe('A#');
  });
});
