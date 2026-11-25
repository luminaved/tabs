import { describe, expect, it } from 'vitest';
import { parseSong } from './parse';
import { transposeSong } from './transform';
import { LyricLine } from './types';

function chords(song: ReturnType<typeof parseSong>): string[] {
  const out: string[] = [];
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric') continue;
      for (const seg of (line as LyricLine).segments) {
        if (seg.chord !== undefined) out.push(seg.chord);
      }
    }
  }
  return out;
}

describe('transposeSong', () => {
  it('написание нот следует за целевой тональностью (A → Bb: Bb, не A#)', () => {
    const song = parseSong('{key: A}\n[A]la [E]la [D]la');
    const up = transposeSong(song, 1);
    expect(up.meta.key).toBe('Bb');
    expect(chords(up)).toEqual(['Bb', 'F', 'Eb']);
  });

  it('вверх в диезную тональность даёт диезы', () => {
    const song = parseSong('{key: C}\n[C]x [F]y');
    const up = transposeSong(song, 2); // → D-мажор (диезная)
    expect(up.meta.key).toBe('D');
    expect(chords(up)).toEqual(['D', 'G']);
  });

  it('без тональности — по умолчанию диезы, meta.key не появляется', () => {
    const song = parseSong('[A]x');
    const up = transposeSong(song, 1);
    expect(up.meta.key).toBeUndefined();
    expect(chords(up)).toEqual(['A#']);
  });

  it('сдвиг 0 возвращает исходный объект без изменений', () => {
    const song = parseSong('{key: C}\n[C]x');
    expect(transposeSong(song, 0)).toBe(song);
  });

  it('капо не трогается при транспонировании', () => {
    const song = parseSong('{key: C}\n{capo: 3}\n[C]x');
    const up = transposeSong(song, 2);
    expect(up.meta.capo).toBe(3);
  });

  it('slash-аккорды транспонируются целиком', () => {
    const song = parseSong('{key: D}\n[D]x [D/F#]y');
    const up = transposeSong(song, 2); // D → E (диезная)
    expect(chords(up)).toEqual(['E', 'E/G#']);
  });
});
