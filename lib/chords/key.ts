/**
 * Тональности, выбор диез/бемоль и капо.
 *
 * Ключевое требование: написание нот зависит от ЦЕЛЕВОЙ тональности —
 * в Bb-мажоре нота на 10-м полутоне пишется как `Bb`, а не `A#`.
 *
 * Таблицы предпочтительных имён тональностей и функция `accidentalForKey`
 * внутренне согласованы по кругу квинт (относительный минор мажора берёт
 * то же написание): напр. Gb-мажор ↔ Ebm — обе бемольные.
 */

import { Accidental, mod12, noteToPc, pcToName } from './pitch';

export interface Key {
  tonicPc: number;
  minor: boolean;
  /** Исходная строка тональности как её записали. */
  name: string;
}

// Предпочтительное имя тональности для каждой из 12 высот тоники.
// Чёрные клавиши — через бемоль (распространённая гитарная конвенция).
const MAJOR_BY_PC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_BY_PC = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

// Натуральные (без знака в названии) тональности, которые всё же бемольные.
const NATURAL_FLAT_MAJORS = new Set(['F']);
const NATURAL_FLAT_MINORS = new Set(['C', 'D', 'F', 'G']);

/** Разбирает тональность: «Am», «Bb», «F#m», «Cminor». */
export function parseKey(name: string): Key | null {
  const m = /^([A-G][#b]*)(m|min|minor)?$/.exec(name.trim());
  if (!m) return null;
  const tonicPc = noteToPc(m[1]);
  if (tonicPc === null) return null;
  return { tonicPc, minor: m[2] !== undefined, name: name.trim() };
}

/**
 * Диез или бемоль для данной тональности.
 * Знак в самом названии имеет приоритет; для натуральных — по кругу квинт.
 */
export function accidentalForKey(name: string): Accidental {
  const key = parseKey(name);
  if (!key) return 'sharp';
  if (key.name.includes('b')) return 'flat';
  if (key.name.includes('#')) return 'sharp';
  const letter = key.name[0];
  const flats = key.minor ? NATURAL_FLAT_MINORS : NATURAL_FLAT_MAJORS;
  return flats.has(letter) ? 'flat' : 'sharp';
}

/**
 * Название тональности после сдвига на `semitones` полутонов —
 * с предпочтительным написанием целевой тональности.
 */
export function transposeKey(name: string, semitones: number): string {
  const key = parseKey(name);
  if (!key) return name;
  const pc = mod12(key.tonicPc + semitones);
  return key.minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc];
}

// Ступени и качества трезвучий: мажор и натуральный минор.
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUAL = ['', 'm', 'm', '', '', 'm', 'dim'];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUAL = ['m', 'dim', '', 'm', 'm', '', ''];

/**
 * Диатонические трезвучия тональности — для палитры быстрой вставки.
 * Напр. Am → [Am, Bdim, C, Dm, Em, F, G]. Неизвестная тональность → [].
 */
export function diatonicChords(name: string): string[] {
  const key = parseKey(name);
  if (!key) return [];
  const acc = accidentalForKey(name);
  const steps = key.minor ? MINOR_STEPS : MAJOR_STEPS;
  const qual = key.minor ? MINOR_QUAL : MAJOR_QUAL;
  return steps.map((s, i) => pcToName(mod12(key.tonicPc + s), acc) + qual[i]);
}

/**
 * Сдвиг для отображения аппликатур при капо.
 *
 * Капо не меняет реальное звучание: гитарист зажимает формы на `capo`
 * полутонов НИЖЕ реального аккорда, а капо поднимает их обратно.
 * Итоговый сдвиг форм = транспонирование пользователя минус лад капо.
 */
export function capoShapeShift(transpose: number, capo: number): number {
  return transpose - capo;
}
