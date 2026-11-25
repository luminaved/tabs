/**
 * Разбор и транспонирование аккордов.
 *
 * Аккорд = корень + суффикс (качество) + опциональный бас (slash).
 * Транспонируются только высоты корня и баса; суффикс (maj7, m7b5, sus4, add9…)
 * переносится как есть. Написание нот при форматировании задаётся извне —
 * оно зависит от целевой тональности, а не от самого аккорда.
 */

import { Accidental, mod12, noteToPc, pcToName } from './pitch';

export interface Chord {
  /** Высота корня, 0..11. */
  rootPc: number;
  /** Суффикс качества: '', 'm', 'maj7', 'm7b5', 'sus4', 'add9', '7#9'… */
  quality: string;
  /** Высота баса (slash-аккорд) либо null. */
  bassPc: number | null;
}

// Корень: [A-G] + любые диезы/бемоли. Качество: всё до '/' и пробела.
// Бас (опц.): после '/'. Якоря ^…$ отсекают мусор → не-аккорды вернут null.
const CHORD_RE = /^([A-G][#b]*)([^/\s]*)(?:\/([A-G][#b]*))?$/;

/**
 * Разбирает текст аккорда. Возвращает null для не-аккордов
 * («N.C.», «%», произвольный текст) — вызывающий код оставляет их как есть.
 */
export function parseChord(text: string): Chord | null {
  const m = CHORD_RE.exec(text.trim());
  if (!m) return null;

  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;

  let bassPc: number | null = null;
  if (m[3] !== undefined) {
    const b = noteToPc(m[3]);
    if (b === null) return null;
    bassPc = b;
  }

  return { rootPc, quality: m[2] ?? '', bassPc };
}

/** Собирает строку аккорда, выбирая написание нот по `accidental`. */
export function formatChord(chord: Chord, accidental: Accidental): string {
  let out = pcToName(chord.rootPc, accidental) + chord.quality;
  if (chord.bassPc !== null) out += '/' + pcToName(chord.bassPc, accidental);
  return out;
}

/**
 * Транспонирует один аккорд на `semitones` полутонов.
 * Не-аккорды возвращаются без изменений.
 */
export function transposeChord(text: string, semitones: number, accidental: Accidental): string {
  const chord = parseChord(text);
  if (!chord) return text;
  return formatChord(
    {
      rootPc: mod12(chord.rootPc + semitones),
      quality: chord.quality,
      bassPc: chord.bassPc === null ? null : mod12(chord.bassPc + semitones),
    },
    accidental,
  );
}
