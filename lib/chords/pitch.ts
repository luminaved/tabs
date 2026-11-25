/**
 * Ноты и высоты (pitch class 0..11). Чистый модуль без внешних зависимостей.
 *
 * pitch class: C=0, C#/Db=1, D=2, ... B=11.
 * Написание ноты (диез/бемоль) определяется НЕ высотой, а контекстом —
 * поэтому формат отделён от арифметики (см. `pcToName`).
 */

export type Accidental = 'sharp' | 'flat';

const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Остаток от деления на 12, всегда в диапазоне 0..11 (в т.ч. для отрицательных). */
export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * Разбирает имя ноты («C», «F#», «Bb», «C##») в pitch class 0..11.
 * Возвращает null, если строка не является нотой.
 */
export function noteToPc(note: string): number | null {
  const m = /^([A-G])([#b]*)$/.exec(note);
  if (!m) return null;
  let pc = LETTER_SEMITONES[m[1]];
  for (const ch of m[2]) pc += ch === '#' ? 1 : -1;
  return mod12(pc);
}

/** Имя ноты для pitch class с явным выбором диез/бемоль. */
export function pcToName(pc: number, accidental: Accidental): string {
  const names = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(pc)];
}
