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

/**
 * Меняет в строке списка весь текст песни на готовый список аккордов.
 *
 * Строки списков показывают чипы аккордов, а считаются они из `body`. Тащить
 * ради них текст дальше выборки не нужно и дорого: подгрузка следующей порции
 * каталога — серверный экшен, и его результат уезжает на клиент целиком. То
 * есть каждое «Показать ещё» пересылало десятки килобайт текста песен ради
 * десятка коротких подписей. Аккорды считаем на сервере, где текст и так есть.
 */
export function withChordChips<T extends { body: string }>(
  song: T,
): Omit<T, 'body'> & { chords: string[] } {
  const { body, ...rest } = song;
  return { ...rest, chords: chordsInOrder(body) };
}
