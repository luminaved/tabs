import { describe, expect, it } from 'vitest';
import { songFromRecord } from './fromRecord';

describe('songFromRecord', () => {
  it('поля записи перекрывают директивы внутри body', () => {
    const song = songFromRecord({
      title: 'Из колонки',
      key: 'Am',
      capo: 2,
      body: '{title: Из директивы}\n{key: C}\n[C]текст',
    });
    expect(song.meta.title).toBe('Из колонки');
    expect(song.meta.key).toBe('Am');
    expect(song.meta.capo).toBe(2);
  });

  it('если поля пустые — берётся мета из директив', () => {
    const song = songFromRecord({ body: '{title: Только body}\n{key: G}\n[G]текст' });
    expect(song.meta.title).toBe('Только body');
    expect(song.meta.key).toBe('G');
  });

  it('секции парсятся из body', () => {
    const song = songFromRecord({ title: 'X', body: '[C]раз [G]два' });
    expect(song.sections[0].lines[0]).toMatchObject({ type: 'lyric' });
  });
});
