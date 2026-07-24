/** AST песни в формате ChordPro. Потребляется рендером — без UI-зависимостей. */

export interface SongMeta {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  tempo?: number;
  time?: string;
  /** Прочие директивы, которые мы не выделяем отдельно. */
  [key: string]: string | number | undefined;
}

export type SectionKind = 'verse' | 'chorus' | 'bridge' | 'tab' | 'none';

/** Отрезок строки: аккорд (опц.) + следующий за ним текст (слог/слова). */
export interface Segment {
  chord?: string;
  text: string;
}

export interface LyricLine {
  type: 'lyric';
  /** Номер исходной строки (1-based) — якорь для аннотаций. */
  line: number;
  segments: Segment[];
}

export interface CommentLine {
  type: 'comment';
  line: number;
  text: string;
}

export interface EmptyLine {
  type: 'empty';
  line: number;
}

export type Line = LyricLine | CommentLine | EmptyLine;

export interface Section {
  kind: SectionKind;
  /** Метка секции из директивы, напр. {start_of_chorus: Припев}. */
  label?: string;
  /** Номер исходной строки, где секция началась. */
  startLine: number;
  lines: Line[];
}

export interface Song {
  meta: SongMeta;
  sections: Section[];
}
