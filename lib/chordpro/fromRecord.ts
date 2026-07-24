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
 */
export function songFromRecord(rec: SongRecordLike): Song {
  const song = parseSong(rec.body);
  const meta = { ...song.meta };
  if (rec.title) meta.title = rec.title;
  if (rec.artist) meta.artist = rec.artist;
  if (rec.key) meta.key = rec.key;
  if (rec.capo != null) meta.capo = rec.capo;
  if (rec.tempo != null) meta.tempo = rec.tempo;
  return { meta, sections: song.sections };
}
