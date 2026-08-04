/**
 * Потолки длины полей разбора и заметки.
 *
 * Заведены отдельным модулем не для красоты. До этого ограничения стояли
 * везде, КРОМЕ самого разбора: обложка — 400 КБ (imageInput.ts), аватар —
 * 150 КБ, пароль — 72 байта (validation.ts), заявка — 120 символов
 * (songRequests.ts), имя в профиле — 80. А `title`, `artist`, `key`, `note`,
 * `body` и `chordDefs` не проверял никто, хотя форма уходит в серверный экшен
 * и клиентские `maxLength` обходятся одним запросом мимо браузера.
 *
 * Дорого это не только в хранении. `body` тянет за собой три вещи сразу:
 *   — из него собирается `searchText`, а по той колонке стоит триграммный
 *     GIN-индекс (scripts/setup-search.mjs) — он растёт от размера текста
 *     быстрее, чем сам текст;
 *   — `cardSelect`/`catalogSelect` ВЫБИРАЮТ `body` ради чипов аккордов, то
 *     есть страница каталога тащит из базы двадцать четыре текста разом;
 *   — `chordsInOrder` прогоняет по нему регулярку на каждую строку списка.
 *
 * Значения с большим запасом к живым данным: самый длинный разбор в базе —
 * около 4 КБ, самая длинная заметка от автора — пара строк. Потолок здесь
 * защищает от злоупотребления, а не редактирует поведение человека.
 *
 * Считаем в символах строки JS (единицы UTF-16), как и остальные проверки в
 * проекте: для кириллицы и латиницы это ровно символы, эмодзи считается за
 * два. Точность здесь не нужна — нужен порядок величины.
 */

/** Потолки текстовых полей разбора. */
export const SONG_LIMITS = {
  title: 200,
  artist: 120,
  /** «Am», «F#m», «Cminor» — шестнадцати хватает любой записи тональности. */
  key: 16,
  note: 2_000,
  /** ChordPro целиком. Живой максимум ~4 КБ, здесь запас в двадцать пять раз. */
  body: 100_000,
  /** JSON кастомных аппликатур: ~60 символов на аккорд. */
  chordDefs: 20_000,
} as const;

export type SongLimitField = keyof typeof SONG_LIMITS;

/** Темп. Ниже — уже не музыка, выше — опечатка (у формы стоит те же границы). */
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 400;

/** Капо. Двенадцатый лад — октава; выше капо не ставят. */
export const CAPO_MIN = 0;
export const CAPO_MAX = 12;

/** Заметка к строке песни. Видна всем на публичной странице. */
export const ANNOTATION_MAX = 500;

/** Человеческие названия полей — они попадают в текст ошибки. */
const FIELD_LABEL: Record<SongLimitField, string> = {
  title: 'Название',
  artist: 'Имя исполнителя',
  key: 'Тональность',
  note: 'Заметка от автора',
  body: 'Текст песни',
  chordDefs: 'Аппликатуры',
};

/**
 * Проверяет длину одного поля. Возвращает текст ошибки либо null.
 *
 * Обрезать молча нельзя: у `body` это потеря чужой работы без единого слова,
 * а у остальных полей — правка, о которой человек узнает, только перечитав
 * сохранённое. Поэтому отказ с объяснением.
 */
export function checkLength(field: SongLimitField, value: string): string | null {
  const max = SONG_LIMITS[field];
  if (value.length <= max) return null;
  return `${FIELD_LABEL[field]} длиннее ${max} символов (сейчас ${value.length})`;
}

/** Поля разбора, как они приходят из формы, — до нормализации. */
export interface SongTextFields {
  title: string;
  artist: string;
  key: string;
  note: string;
  body: string;
  chordDefs: string;
}

/**
 * Проверяет все текстовые поля разбора разом. Возвращает текст ПЕРВОЙ ошибки
 * либо null. Порядок обхода — как поля идут в форме, чтобы человек правил их
 * сверху вниз, а не прыгал по странице.
 */
export function checkSongFields(fields: SongTextFields): string | null {
  const order: SongLimitField[] = ['title', 'artist', 'key', 'note', 'body', 'chordDefs'];
  for (const field of order) {
    const error = checkLength(field, fields[field]);
    if (error) return error;
  }
  return null;
}

/**
 * Целое число из строки формы в заданных границах, иначе null.
 *
 * Используется темпом и капо. Пустое поле — это «не указано», а не ноль:
 * ноль у капо значащий (нет капо), у темпа — бессмысленный, и различать их
 * должен вызывающий код через `min`.
 */
export function parseBoundedInt(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  if (int < min || int > max) return null;
  return int;
}
