import { describe, expect, it } from 'vitest';
import {
  ANNOTATION_MAX,
  CAPO_MAX,
  SONG_LIMITS,
  TEMPO_MAX,
  TEMPO_MIN,
  checkLength,
  checkSongFields,
  parseBoundedInt,
  type SongTextFields,
} from './songLimits';

/** Поля «как из пустой формы» — случаи меняют в них ровно одно. */
const empty: SongTextFields = {
  title: '',
  artist: '',
  key: '',
  note: '',
  body: '',
  chordDefs: '',
};

const of = (n: number, ch = 'a') => ch.repeat(n);

describe('checkLength', () => {
  it('ровно потолок проходит, потолок+1 — нет', () => {
    expect(checkLength('title', of(SONG_LIMITS.title))).toBeNull();
    expect(checkLength('title', of(SONG_LIMITS.title + 1))).not.toBeNull();
  });

  it('в тексте ошибки есть и потолок, и фактическая длина', () => {
    const error = checkLength('artist', of(SONG_LIMITS.artist + 5));
    expect(error).toContain(String(SONG_LIMITS.artist));
    expect(error).toContain(String(SONG_LIMITS.artist + 5));
  });

  it('пустое значение всегда проходит', () => {
    for (const field of Object.keys(SONG_LIMITS) as (keyof typeof SONG_LIMITS)[]) {
      expect(checkLength(field, '')).toBeNull();
    }
  });

  it('кириллица считается посимвольно, а не побайтно', () => {
    // Иначе русское название упиралось бы в потолок вдвое раньше латинского.
    expect(checkLength('title', of(SONG_LIMITS.title, 'я'))).toBeNull();
  });
});

describe('checkSongFields', () => {
  it('обычный разбор проходит', () => {
    expect(
      checkSongFields({
        ...empty,
        title: 'Тёплый вечер',
        artist: 'Демо',
        key: 'G',
        body: '[C]Первая [G]строка',
      }),
    ).toBeNull();
  });

  it('ловит каждое поле по отдельности', () => {
    for (const field of Object.keys(SONG_LIMITS) as (keyof typeof SONG_LIMITS)[]) {
      const over = { ...empty, [field]: of(SONG_LIMITS[field] + 1) };
      expect(checkSongFields(over), `поле ${field}`).not.toBeNull();
    }
  });

  it('сообщает про ПЕРВОЕ поле по порядку формы, а не про случайное', () => {
    const error = checkSongFields({
      ...empty,
      title: of(SONG_LIMITS.title + 1),
      body: of(SONG_LIMITS.body + 1),
    });
    expect(error).toContain('Название');
  });

  it('тело песни ограничено — иначе каталог тащит его из базы двадцатью строками', () => {
    expect(checkSongFields({ ...empty, body: of(SONG_LIMITS.body) })).toBeNull();
    expect(checkSongFields({ ...empty, body: of(SONG_LIMITS.body + 1) })).not.toBeNull();
  });
});

describe('parseBoundedInt', () => {
  it('пустая строка — «не указано»', () => {
    expect(parseBoundedInt('', TEMPO_MIN, TEMPO_MAX)).toBeNull();
    expect(parseBoundedInt('   ', TEMPO_MIN, TEMPO_MAX)).toBeNull();
  });

  it('мусор не становится числом', () => {
    expect(parseBoundedInt('abc', TEMPO_MIN, TEMPO_MAX)).toBeNull();
    expect(parseBoundedInt('NaN', TEMPO_MIN, TEMPO_MAX)).toBeNull();
    expect(parseBoundedInt('Infinity', TEMPO_MIN, TEMPO_MAX)).toBeNull();
  });

  it('за границами — null, на границах — проходит', () => {
    expect(parseBoundedInt(String(TEMPO_MIN - 1), TEMPO_MIN, TEMPO_MAX)).toBeNull();
    expect(parseBoundedInt(String(TEMPO_MAX + 1), TEMPO_MIN, TEMPO_MAX)).toBeNull();
    expect(parseBoundedInt(String(TEMPO_MIN), TEMPO_MIN, TEMPO_MAX)).toBe(TEMPO_MIN);
    expect(parseBoundedInt(String(TEMPO_MAX), TEMPO_MIN, TEMPO_MAX)).toBe(TEMPO_MAX);
  });

  it('дробное усекается', () => {
    expect(parseBoundedInt('92.7', TEMPO_MIN, TEMPO_MAX)).toBe(92);
  });

  it('ноль у капо значащий — это «без капо»', () => {
    expect(parseBoundedInt('0', 0, CAPO_MAX)).toBe(0);
  });
});

describe('сами значения потолков', () => {
  it('заданы положительными', () => {
    for (const [field, max] of Object.entries(SONG_LIMITS)) {
      expect(max, `поле ${field}`).toBeGreaterThan(0);
    }
    expect(ANNOTATION_MAX).toBeGreaterThan(0);
  });

  it('текст песни — самое просторное поле', () => {
    // Если однажды кто-то опустит его до уровня названия, разборы перестанут
    // сохраняться, и понять почему будет непросто.
    for (const [field, max] of Object.entries(SONG_LIMITS)) {
      if (field === 'body') continue;
      expect(SONG_LIMITS.body, `body против ${field}`).toBeGreaterThan(max);
    }
  });
});
