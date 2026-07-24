import type { Song } from './types';

/** Уникальные аккорды из разобранной (в т.ч. транспонированной) песни, по порядку. */
export function chordsFromSong(song: Song): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric') continue;
      for (const seg of line.segments) {
        const c = seg.chord?.trim();
        if (c && !seen.has(c)) {
          seen.add(c);
          out.push(c);
        }
      }
    }
  }
  return out;
}

/**
 * Уникальные аккорды из текста ChordPro в порядке первого появления.
 * Напр. «…[2Н]…[3В]…[5Н]…[5В]…[2Н]…» → ['2Н','3В','5Н','5В'].
 * Чистая функция без зависимостей от UI.
 */
export function chordsInOrder(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(/\[([^\]]+)\]/g)) {
    const chord = m[1].trim();
    if (chord && !seen.has(chord)) {
      seen.add(chord);
      out.push(chord);
    }
  }
  return out;
}
