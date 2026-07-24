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

export function transposeSong(song: Song, semitones: number): Song {
  if (semitones === 0) return song;

  const targetKey = song.meta.key ? transposeKey(song.meta.key, semitones) : undefined;
  const accidental: Accidental = targetKey ? accidentalForKey(targetKey) : 'sharp';

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
