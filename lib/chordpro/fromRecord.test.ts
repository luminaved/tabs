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

  describe('капо', () => {
    it('капо 0 из колонки НЕ перебивает директиву в тексте', () => {
      // У колонки `@default(0)`, поэтому «капо нет» и «капо не задавали» в базе
      // неразличимы. Если бы ноль побеждал, у всех разборов, где капо написано
      // директивой, оно бы молча пропало в день, когда страница начала эту
      // колонку выбирать.
      const song = songFromRecord({ capo: 0, body: '{capo: 3}\n[C]текст' });
      expect(song.meta.capo).toBe(3);
    });

    it('положительное капо из колонки перебивает директиву', () => {
      const song = songFromRecord({ capo: 5, body: '{capo: 3}\n[C]текст' });
      expect(song.meta.capo).toBe(5);
    });

    it('без капо нигде — его нет и в мете', () => {
      const song = songFromRecord({ capo: 0, body: '[C]текст' });
      expect(song.meta.capo).toBeUndefined();
    });

    it('капо из колонки работает и без директивы', () => {
      const song = songFromRecord({ capo: 4, body: '[C]текст' });
      expect(song.meta.capo).toBe(4);
    });
  });
});
