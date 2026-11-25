/**
 * Парсер ChordPro. Разбирает `[Chord]`, директивы ({title:}, {comment:}…)
 * и секции (куплет/припев/бридж) в структурированный AST.
 *
 * Номера исходных строк сохраняются на каждой строке — на них навешиваются
 * аннотации. Текст `Song.body` хранится как есть и парсится на рендере.
 */

import { Line, Section, SectionKind, Segment, Song, SongMeta } from './types';

// Директива занимает всю строку целиком: {name} или {name: value}.
const DIRECTIVE_RE = /^\s*\{\s*([a-zA-Z_]+)\s*:?\s*([^}]*)\}\s*$/;

const SECTION_STARTS: Record<string, SectionKind> = {
  start_of_chorus: 'chorus',
  soc: 'chorus',
  start_of_verse: 'verse',
  sov: 'verse',
  start_of_bridge: 'bridge',
  sob: 'bridge',
  start_of_tab: 'tab',
  sot: 'tab',
};

const SECTION_ENDS = new Set([
  'end_of_chorus',
  'eoc',
  'end_of_verse',
  'eov',
  'end_of_bridge',
  'eob',
  'end_of_tab',
  'eot',
]);

/**
 * Разбивает одну строку текста на отрезки «аккорд + текст».
 * Аккорд относится к тексту, идущему за ним до следующего `[` или конца строки.
 * Текст до первого аккорда попадает в отрезок без аккорда.
 */
export function parseLyricLine(raw: string): Segment[] {
  const parts = raw.split(/(\[[^\]]*\])/g);
  const segments: Segment[] = [];
  let pendingChord: string | undefined;

  for (const part of parts) {
    if (part === '') continue;
    const isChord = part.length >= 2 && part[0] === '[' && part[part.length - 1] === ']';
    if (isChord) {
      // Два аккорда подряд без текста между ними.
      if (pendingChord !== undefined) segments.push({ chord: pendingChord, text: '' });
      pendingChord = part.slice(1, -1);
    } else if (pendingChord !== undefined) {
      segments.push({ chord: pendingChord, text: part });
      pendingChord = undefined;
    } else {
      segments.push({ text: part });
    }
  }
  if (pendingChord !== undefined) segments.push({ chord: pendingChord, text: '' });
  return segments;
}

export function parseSong(source: string): Song {
  const meta: SongMeta = {};
  const sections: Section[] = [];
  let current: Section | null = null;

  const openSection = (kind: SectionKind, startLine: number, label?: string): void => {
    current = { kind, label, startLine, lines: [] };
    sections.push(current);
  };

  const ensureSection = (startLine: number): Section => {
    if (!current) openSection('none', startLine);
    return current as Section;
  };

  const handleDirective = (name: string, value: string, lineNo: number): void => {
    switch (name) {
      case 'title':
      case 't':
        meta.title = value;
        return;
      case 'subtitle':
      case 'st':
      case 'artist':
        meta.artist = value;
        return;
      case 'key':
        meta.key = value;
        return;
      case 'capo':
        meta.capo = Number(value) || 0;
        return;
      case 'tempo': {
        const t = Number(value);
        if (!Number.isNaN(t) && t > 0) meta.tempo = t;
        return;
      }
      case 'time':
        meta.time = value;
        return;
      case 'comment':
      case 'c':
      case 'comment_italic':
      case 'ci':
        ensureSection(lineNo).lines.push({ type: 'comment', line: lineNo, text: value });
        return;
    }

    if (name in SECTION_STARTS) {
      openSection(SECTION_STARTS[name], lineNo, value || undefined);
      return;
    }
    if (SECTION_ENDS.has(name)) {
      current = null;
      return;
    }
    // Неизвестная директива — сохраняем в meta, чтобы не потерять.
    meta[name] = value;
  };

  const rawLines = source.replace(/\r\n?/g, '\n').split('\n');
  rawLines.forEach((raw, i) => {
    const lineNo = i + 1;

    const dir = DIRECTIVE_RE.exec(raw);
    if (dir) {
      handleDirective(dir[1].toLowerCase(), dir[2].trim(), lineNo);
      return;
    }

    if (raw.trim() === '') {
      // Пустые строки сохраняем только внутри уже открытой секции.
      if (current) (current as Section).lines.push({ type: 'empty', line: lineNo });
      return;
    }

    ensureSection(lineNo).lines.push({
      type: 'lyric',
      line: lineNo,
      segments: parseLyricLine(raw),
    });
  });

  return { meta, sections };
}

export type { Line, Section, SectionKind, Segment, Song, SongMeta };
