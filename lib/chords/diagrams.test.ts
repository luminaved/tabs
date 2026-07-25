import { describe, expect, it } from 'vitest';
import { getChordShape, parseFrets } from './diagrams';

describe('getChordShape', () => {
  it('встроенные open-аккорды', () => {
    expect(getChordShape('C')).toEqual({ frets: [-1, 3, 2, 0, 1, 0] });
    expect(getChordShape('Am')).toEqual({ frets: [-1, 0, 2, 2, 1, 0] });
  });

  it('генерирует барре-форму для нестандартных корней', () => {
    // F#m — E-форма минора, барре на 2 ладу (F# = pc6, 6-4=2)
    expect(getChordShape('F#m')).toEqual({ frets: [2, 4, 4, 2, 2, 2] });
    // G#m — барре на 4 ладу
    expect(getChordShape('G#m')).toEqual({ frets: [4, 6, 6, 4, 4, 4] });
  });

  it('бас в slash-аккорде игнорируется', () => {
    expect(getChordShape('D/F#')).toEqual({ frets: [-1, -1, 0, 2, 3, 2] });
  });

  it('кастомная аппликатура имеет приоритет', () => {
    expect(getChordShape('2Н', { '2Н': { frets: [-1, -1, 3, 3, 3, -1] } })).toEqual({
      frets: [-1, -1, 3, 3, 3, -1],
    });
  });

  it('кастомная аппликатура с баррэ', () => {
    const shape = { frets: [1, 3, 3, 2, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] };
    expect(getChordShape('Fbar', { Fbar: shape })).toEqual(shape);
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

  it('без формы — null', () => {
    expect(getChordShape('Csus4')).toBeNull();
    expect(getChordShape('Xyz')).toBeNull();
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
