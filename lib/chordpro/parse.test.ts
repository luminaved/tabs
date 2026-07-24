import { describe, expect, it } from 'vitest';
import { parseLyricLine, parseSong } from './parse';
import { LyricLine } from './types';

describe('parseLyricLine', () => {
  it('аккорд относится к тексту, идущему за ним', () => {
    expect(parseLyricLine('[Am]Текст с [C]аккордами')).toEqual([
      { chord: 'Am', text: 'Текст с ' },
      { chord: 'C', text: 'аккордами' },
    ]);
  });

  it('текст до первого аккорда — без аккорда', () => {
    expect(parseLyricLine('Текст [Am]тут')).toEqual([
      { text: 'Текст ' },
      { chord: 'Am', text: 'тут' },
    ]);
  });

  it('два аккорда подряд', () => {
    expect(parseLyricLine('[Am][C]слово')).toEqual([
      { chord: 'Am', text: '' },
      { chord: 'C', text: 'слово' },
    ]);
  });

  it('аккорд в конце строки', () => {
    expect(parseLyricLine('конец [G]')).toEqual([
      { text: 'конец ' },
      { chord: 'G', text: '' },
    ]);
  });

  it('строка без аккордов', () => {
    expect(parseLyricLine('просто текст')).toEqual([{ text: 'просто текст' }]);
  });
});

describe('parseSong — директивы и meta', () => {
  const song = parseSong(
    [
      '{title: Yesterday}',
      '{artist: The Beatles}',
      '{key: F}',
      '{capo: 2}',
      '{tempo: 96}',
    ].join('\n'),
  );

  it('читает заголовок, исполнителя, тональность, капо, темп', () => {
    expect(song.meta).toMatchObject({
      title: 'Yesterday',
      artist: 'The Beatles',
      key: 'F',
      capo: 2,
      tempo: 96,
    });
  });

  it('сокращённые формы директив', () => {
    const s = parseSong('{t: Song}\n{st: Artist}');
    expect(s.meta.title).toBe('Song');
    expect(s.meta.artist).toBe('Artist');
  });
});

describe('parseSong — секции', () => {
  const source = [
    '{title: Test}', // 1
    '', // 2
    '[C]First verse [G]line', // 3
    '{start_of_chorus: Припев}', // 4
    '[Am]Chorus [F]here', // 5
    '{end_of_chorus}', // 6
    '{comment: тихо}', // 7
    '[C]Back to verse', // 8
  ].join('\n');
  const song = parseSong(source);

  it('разделяет куплет / припев', () => {
    const kinds = song.sections.map((s) => s.kind);
    expect(kinds).toEqual(['none', 'chorus', 'none']);
  });

  it('метка секции из директивы', () => {
    const chorus = song.sections.find((s) => s.kind === 'chorus');
    expect(chorus?.label).toBe('Припев');
  });

  it('комментарий становится строкой-комментарием', () => {
    const lastSection = song.sections[song.sections.length - 1];
    expect(lastSection.lines[0]).toMatchObject({ type: 'comment', text: 'тихо' });
  });

  it('номера исходных строк сохраняются как якоря аннотаций', () => {
    const firstVerse = song.sections[0];
    const lyric = firstVerse.lines.find((l) => l.type === 'lyric') as LyricLine;
    expect(lyric.line).toBe(3);

    const chorus = song.sections[1];
    const chorusLyric = chorus.lines.find((l) => l.type === 'lyric') as LyricLine;
    expect(chorusLyric.line).toBe(5);
  });

  it('сегменты аккордов внутри секции', () => {
    const chorus = song.sections[1];
    const lyric = chorus.lines.find((l) => l.type === 'lyric') as LyricLine;
    expect(lyric.segments).toEqual([
      { chord: 'Am', text: 'Chorus ' },
      { chord: 'F', text: 'here' },
    ]);
  });
});

describe('parseSong — переводы строк и пустые строки', () => {
  it('нормализует CRLF и хранит пустые строки внутри секции', () => {
    const song = parseSong('[C]line one\r\n\r\n[G]line two');
    const section = song.sections[0];
    const types = section.lines.map((l) => l.type);
    expect(types).toEqual(['lyric', 'empty', 'lyric']);
  });
});
