import { describe, expect, it } from 'vitest';
import { buildSearchText, searchQueryForLike, stripChordPro } from './searchText';

describe('stripChordPro', () => {
  it('убирает аккорды, склеивая разорванное слово', () => {
    // Ради этого всё и затевалось: «друзья» разорвано аккордом посередине.
    expect(stripChordPro('[G]Свет за [D]окном, дру[C]зья')).toBe('Свет за окном, друзья');
  });

  it('убирает директивы', () => {
    expect(stripChordPro('{title: Тёплый вечер}\n{start_of_verse}\nтекст')).toBe('текст');
  });

  it('убирает знаки серого текста, оставляя слова', () => {
    expect(stripChordPro('[Em]пой %(× 2)%')).toBe('пой (× 2)');
  });

  it('схлопывает переносы и лишние пробелы', () => {
    expect(stripChordPro('первая\n\n  вторая   строка')).toBe('первая вторая строка');
  });

  it('пустой текст остаётся пустым', () => {
    expect(stripChordPro('')).toBe('');
    expect(stripChordPro('{title: только мета}')).toBe('');
  });
});

describe('buildSearchText', () => {
  it('склеивает название, исполнителя и слова в нижнем регистре', () => {
    expect(
      buildSearchText({ title: 'Влечение', artist: 'CUPSIZE', body: '[Am]Тёплый [C]вечер' }),
    ).toBe('влечение cupsize тёплый вечер');
  });

  it('без исполнителя лишних пробелов не появляется', () => {
    expect(buildSearchText({ title: 'Песня', artist: null, body: 'текст' })).toBe(
      'песня текст',
    );
  });

  it('находится строка из середины песни', () => {
    const text = buildSearchText({
      title: 'Тёплый вечер',
      artist: 'демо',
      body: '{start_of_chorus}\n[C]Пой, пока [G]тянется [D]нить',
    });
    expect(text).toContain('пока тянется нить');
  });
});

describe('searchQueryForLike', () => {
  it('пустой запрос — искать нечего', () => {
    expect(searchQueryForLike(undefined)).toBeNull();
    expect(searchQueryForLike('')).toBeNull();
    expect(searchQueryForLike('   ')).toBeNull();
  });

  it('обрезает пробелы и снимает регистр (колонка уже в нижнем)', () => {
    expect(searchQueryForLike('  Влечение ')).toBe('влечение');
  });

  it('экранирует маски LIKE', () => {
    // Без этого «50%» отдавал весь каталог, а «_» совпадал с любым символом.
    expect(searchQueryForLike('50%')).toBe('50\\%');
    expect(searchQueryForLike('a_b')).toBe('a\\_b');
  });

  it('обратный слеш экранируется первым и не удваивает соседей', () => {
    expect(searchQueryForLike('a\\%')).toBe('a\\\\\\%');
  });

  it('обычный запрос не меняется', () => {
    expect(searchQueryForLike('тёплый вечер')).toBe('тёплый вечер');
  });
});
