import { describe, expect, it } from 'vitest';
import { mod12, noteToPc, pcToName } from './pitch';

describe('mod12', () => {
  it('нормализует положительные и отрицательные', () => {
    expect(mod12(0)).toBe(0);
    expect(mod12(12)).toBe(0);
    expect(mod12(13)).toBe(1);
    expect(mod12(-1)).toBe(11);
    expect(mod12(-13)).toBe(11);
  });
});

describe('noteToPc', () => {
  it('натуральные ноты', () => {
    expect(noteToPc('C')).toBe(0);
    expect(noteToPc('D')).toBe(2);
    expect(noteToPc('E')).toBe(4);
    expect(noteToPc('F')).toBe(5);
    expect(noteToPc('G')).toBe(7);
    expect(noteToPc('A')).toBe(9);
    expect(noteToPc('B')).toBe(11);
  });

  it('диезы и бемоли', () => {
    expect(noteToPc('C#')).toBe(1);
    expect(noteToPc('Db')).toBe(1);
    expect(noteToPc('F#')).toBe(6);
    expect(noteToPc('Gb')).toBe(6);
    expect(noteToPc('Bb')).toBe(10);
    expect(noteToPc('A#')).toBe(10);
  });

  it('двойные знаки и перенос через октаву', () => {
    expect(noteToPc('C##')).toBe(2);
    expect(noteToPc('Cb')).toBe(11);
    expect(noteToPc('B#')).toBe(0);
  });

  it('не-ноты дают null', () => {
    expect(noteToPc('H')).toBeNull();
    expect(noteToPc('')).toBeNull();
    expect(noteToPc('Am')).toBeNull();
  });
});

describe('pcToName', () => {
  it('диезное написание', () => {
    expect(pcToName(1, 'sharp')).toBe('C#');
    expect(pcToName(10, 'sharp')).toBe('A#');
  });
  it('бемольное написание', () => {
    expect(pcToName(1, 'flat')).toBe('Db');
    expect(pcToName(10, 'flat')).toBe('Bb');
  });
});
