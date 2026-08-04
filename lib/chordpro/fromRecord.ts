import { parseSong } from './parse';
import { Song } from './types';

export interface SongRecordLike {
  title?: string | null;
  artist?: string | null;
  key?: string | null;
  capo?: number | null;
  tempo?: number | null;
  body: string;
}

/**
 * Строит AST из ChordPro-текста и накладывает мета из полей записи БД —
 * они главнее директив внутри body (title/artist/key/capo/tempo хранятся
 * отдельными колонками и являются источником истины).
 *
 * ── Почему у капо особое правило ────────────────────────────────────────────
 *
 * Колонка `capo` не nullable: у неё `@default(0)`, то есть «капо нет» и «капо
 * не задавали» в базе выглядят одинаково. Пока страница разбора эту колонку
 * вообще не выбирала, `rec.capo` приходил `undefined`, и капо целиком задавала
 * директива `{capo: 3}` в тексте. Стоило начать выбирать колонку — и у всех
 * существующих разборов оттуда поехал бы ноль, ТИХО перебив директиву: человек
 * бы увидел, что капо из его разбора пропало, и не понял бы почему.
 *
 * Поэтому ноль здесь читается как «не задано» и уступает тексту, а любое
 * положительное значение из формы — перекрывает. Остальные поля так не
 * работают и не должны: у них пустое значение выражается через `null`, который
 * от «не задано» отличается сам.
 */
export function songFromRecord(rec: SongRecordLike): Song {
  const song = parseSong(rec.body);
  const meta = { ...song.meta };
  if (rec.title) meta.title = rec.title;
  if (rec.artist) meta.artist = rec.artist;
  if (rec.key) meta.key = rec.key;
  if (rec.capo != null && rec.capo > 0) meta.capo = rec.capo;
  if (rec.tempo != null) meta.tempo = rec.tempo;
  return { meta, sections: song.sections };
}
