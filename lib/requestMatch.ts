import { slugify } from './slug';
import { parseInstrumentId } from './chords/instruments';

/**
 * Автоматическая связь «заявка ↔ готовый разбор».
 *
 * Раньше связь искала сама база: `title equals … mode: insensitive`. Это
 * держится на том, как конкретный Postgres приводит регистр: на кириллице, на
 * ё, на неразрывных пробелах и разной композиции Unicode (то, что приходит из
 * вставки с телефона) такое сравнение молча не срабатывает — и заявка на
 * «Тривога и паничка» оставалась «ждущей», хотя разбор «тривога и паничка»
 * давно лежал в каталоге.
 *
 * Теперь база отдаёт только список публичных разборов, а сравнение делает
 * JavaScript одной и той же функцией для обеих сторон. Сравниваем не строки, а
 * их «основу» (`looseKey`): регистр, ё/е, пунктуация, кавычки, пробелы и
 * дефисы значения не имеют — «Впустоте», «в пустоте» и «В ПУСТОТЕ!» это одно и
 * то же.
 *
 * Модуль чистый: без базы и без Next — покрыт тестами.
 */

/**
 * Основа строки для сравнения.
 *
 * Идёт через `slugify` (он уже снимает регистр, диакритику и пунктуацию и
 * переводит кириллицу в латиницу), после чего вычёркиваются и дефисы: они там
 * стоят на месте каждого пробела, а нам разница «в пустоте» / «впустоте» не
 * нужна. Если латиницы не осталось (иероглифы, одни знаки), берём сырую строку
 * без пробелов — чтобы такие названия не склеивались в одну пустую основу.
 */
export function looseKey(text: string | null | undefined): string {
  const source = text ?? '';
  const slug = slugify(source).replaceAll('-', '');
  if (slug) return slug;
  return source.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export interface MatchSong {
  id: string;
  title: string;
  artist: string | null;
  instrument: string;
}

export interface MatchRequest {
  title: string;
  artist: string | null;
  instrument: string;
}

export interface SongIndex {
  /** «инструмент | название | исполнитель» → разбор. */
  byPair: Map<string, MatchSong>;
  /** «инструмент | название» → разбор: для заявок без исполнителя. */
  byTitle: Map<string, MatchSong>;
}

function titleKey(instrument: string, title: string): string | null {
  const t = looseKey(title);
  return t ? `${parseInstrumentId(instrument)}|${t}` : null;
}

function pairKey(instrument: string, title: string, artist: string | null): string | null {
  const base = titleKey(instrument, title);
  return base ? `${base}|${looseKey(artist)}` : null;
}

/**
 * Индекс разборов для быстрого поиска. Разборы нужно передавать в порядке
 * выхода (старые первыми): при нескольких подходящих побеждает самый ранний,
 * как и раньше.
 */
export function buildSongIndex(songs: readonly MatchSong[]): SongIndex {
  const byPair = new Map<string, MatchSong>();
  const byTitle = new Map<string, MatchSong>();
  for (const s of songs) {
    const pair = pairKey(s.instrument, s.title, s.artist);
    const title = titleKey(s.instrument, s.title);
    if (pair && !byPair.has(pair)) byPair.set(pair, s);
    if (title && !byTitle.has(title)) byTitle.set(title, s);
  }
  return { byPair, byTitle };
}

/**
 * Разбор, который закрывает заявку, либо null.
 *
 * Без исполнителя заявку закрывает любой разбор с тем же названием — так это
 * задумано для старых записей, заведённых до того, как поле стало
 * обязательным.
 */
export function findSongForRequest(index: SongIndex, request: MatchRequest): MatchSong | null {
  const artist = request.artist?.trim();
  if (!artist) {
    const key = titleKey(request.instrument, request.title);
    return key ? (index.byTitle.get(key) ?? null) : null;
  }
  const key = pairKey(request.instrument, request.title, artist);
  return key ? (index.byPair.get(key) ?? null) : null;
}
