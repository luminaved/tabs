/**
 * Транспонирование целой песни.
 *
 * Написание нот берётся из ЦЕЛЕВОЙ тональности (meta.key после сдвига).
 * Если тональность не задана — по умолчанию диезы. meta.key обновляется,
 * meta.capo остаётся нетронутым (капо — независимая от транспонирования вещь).
 */

import { transposeChord } from '../chords/chord';
import { Accidental } from '../chords/pitch';
import { accidentalForKey, transposeKey } from '../chords/key';
import { Line, Song } from './types';

/**
 * Написание нот (диез/бемоль), которым `transposeSong` подпишет аккорды при
 * данном сдвиге. Вынесено наружу, потому что то же написание нужно переносу
 * своих аппликатур (`transposeChordDefs`): формы лежат под именами аккордов, и
 * разойдись эти два места — форма осталась бы под «A#5», когда в тексте уже
 * «Bb5», то есть исчезла бы с картинки.
 */
export function songAccidental(key: string | undefined, semitones: number): Accidental {
  if (!key) return 'sharp';
  return accidentalForKey(transposeKey(key, semitones));
}

export function transposeSong(song: Song, semitones: number): Song {
  if (semitones === 0) return song;

  const targetKey = song.meta.key ? transposeKey(song.meta.key, semitones) : undefined;
  const accidental = songAccidental(song.meta.key, semitones);

  const sections = song.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line): Line =>
      line.type === 'lyric'
        ? {
            ...line,
            segments: line.segments.map((seg) =>
              seg.chord === undefined
                ? seg
                : { ...seg, chord: transposeChord(seg.chord, semitones, accidental) },
            ),
          }
        : line,
    ),
  }));

  const meta = targetKey ? { ...song.meta, key: targetKey } : song.meta;
  return { meta, sections };
}
