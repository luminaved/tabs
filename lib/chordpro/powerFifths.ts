/**
 * Перевод квинт из записи «лад + В/Н» в стандартные имена прямо в тексте песни.
 *
 * Зачем это нужно, подробно объяснено у `parsePowerFifth` в
 * [lib/chords/diagrams.ts](../chords/diagrams.ts). Коротко: «5В» понимает только
 * эта функция и человек, выросший на русских табах, а разбор аккордов
 * (lib/chords/chord.ts) ждёт корень A-G — и молча оставляет такой аккорд на
 * месте при транспонировании. То есть главная кнопка страницы в таких разборах
 * наполовину не работает, и понять это по виду нельзя.
 *
 * Сама запись из проекта не выкинута: вставленные откуда-то табы по-прежнему
 * рисуются. Меняется только то, что СОХРАНЯЕТСЯ, — и предлагает замену
 * редактор, а не запрещает форма.
 */

import { getInstrument, type InstrumentId } from '../chords/instruments';
import {
  chordNameToPowerFifth,
  getChordShape,
  powerFifthToChordName,
  type ChordShape,
} from '../chords/diagrams';
import { accidentalForKey } from '../chords/key';
import type { Line, Song } from './types';

/** Токен аккорда в тексте ChordPro. Пробелы внутри скобок допускаем. */
const CHORD_TOKEN_RE = /\[([^\]\n]+)\]/g;

export interface PowerFifthRename {
  /** Как записано сейчас: «5В». */
  from: string;
  /** Как надо: «A5». */
  to: string;
}

/**
 * Инструмент решает, есть ли о чём говорить: квинты в этой записи — гитарная
 * вещь, на укулеле их не играют и подсказка там была бы шумом.
 */
function accidentalFor(key: string | null | undefined): 'sharp' | 'flat' {
  return accidentalForKey(key ?? '');
}

/**
 * Какие квинты в тексте записаны по-старому. Без повторов и в порядке первого
 * появления — список идёт человеку в подсказку, и порядок должен совпадать с
 * тем, как он читает свой текст.
 */
export function powerFifthRenames(
  body: string,
  key?: string | null,
  instrument?: InstrumentId | null,
): PowerFifthRename[] {
  if (!getInstrument(instrument).fifthShorthand) return [];
  const accidental = accidentalFor(key);

  const seen = new Set<string>();
  const out: PowerFifthRename[] = [];
  for (const m of body.matchAll(CHORD_TOKEN_RE)) {
    const from = m[1].trim();
    if (seen.has(from)) continue;
    const to = powerFifthToChordName(from, accidental);
    if (!to) continue;
    seen.add(from);
    out.push({ from, to });
  }
  return out;
}

/**
 * Переписывает такие квинты в тексте. Заменяются только целые токены аккордов:
 * «5В» может встретиться и в словах песни, и трогать их нельзя.
 *
 * ВНИМАНИЕ: имя несёт высоту корня, но не позицию, поэтому «5В» и «17В» дадут
 * одно и то же «A5». Позицию сохраняет `powerFifthPins` — вызывать её надо
 * ВМЕСТЕ с этой функцией, иначе картинка на странице разбора съедет.
 */
export function normalizePowerFifths(
  body: string,
  key?: string | null,
  instrument?: InstrumentId | null,
): string {
  if (!getInstrument(instrument).fifthShorthand) return body;
  const accidental = accidentalFor(key);
  return body.replace(CHORD_TOKEN_RE, (full, inner: string) => {
    const to = powerFifthToChordName(inner.trim(), accidental);
    return to ? `[${to}]` : full;
  });
}

const sameFrets = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * Аппликатуры песни после переименования квинт — так, чтобы КАРТИНКА НЕ
 * ИЗМЕНИЛАСЬ.
 *
 * Ради этого всё и написано. Имя несёт высоту корня, но не позицию: «12В» —
 * это форма на двенадцатом ладу, а имя ей достаётся «E5», у которого
 * встроенная форма живёт на открытых струнах. Переименуй текст в одиночку — и
 * человек, нажавший «Заменить», молча получил бы вместо своего разбора другой,
 * на десять ладов ниже. Поэтому там, где встроенная форма расходится с
 * нынешней, нынешняя закрепляется на песне (chordDefs главнее встроенных).
 *
 * Что нарисовано сейчас, спрашиваем у `getChordShape` — ровно той функции,
 * которой рисует страница. Так «картинка не меняется» получается по построению,
 * а не повторением формулы в двух местах, которые потом разъедутся.
 *
 * Возвращает НОВЫЙ полный набор аппликатур: старые ключи убраны (имени «12В» в
 * тексте больше не будет, и форма под ним висела бы мёртвым грузом, уезжая в
 * базу при каждом сохранении), нужные позиции закреплены под новыми именами.
 *
 * Тот же расчёт делает scripts/normalize-power-chords.mjs для уже сохранённых
 * разборов — скрипты в проекте без сборки и TypeScript не импортируют, поэтому
 * при изменении правил править надо оба места.
 */
export function powerFifthPins(
  body: string,
  defs: Record<string, ChordShape>,
  key?: string | null,
  instrument?: InstrumentId | null,
): Record<string, ChordShape> {
  const inst = getInstrument(instrument);
  if (!inst.fifthShorthand) return defs;

  const renames = powerFifthRenames(body, key, instrument);
  if (renames.length === 0) return defs;

  const next: Record<string, ChordShape> = { ...defs };
  for (const { from } of renames) delete next[from];

  for (const { from, to } of renames) {
    const current = getChordShape(from, inst, defs);
    const auto = getChordShape(to, inst);
    // Встроенная форма под новым именем совпадает с нынешней — закреплять
    // нечего. Так происходит со всеми ходовыми позициями: правило выбора струны
    // в `guitarPowerChord` (lib/chords/instruments.ts) нарочно повторяет прежнюю запись.
    if (!current || !auto || sameFrets(current.frets, auto.frets)) continue;
    // Своя форма уже задана под новым именем — не перебиваем. Сюда же попадает
    // столкновение вида «5В и 17В оба дают A5»: закрепится позиция первого по
    // тексту, потому что двух разных позиций одно имя не выражает. Редактор об
    // этом предупреждает до нажатия (см. баннер в SongEditor).
    if (next[to] === undefined) next[to] = current;
  }

  return next;
}

// ─── Показ квинт ладами: «G#5» → «4В» ──────────────────────────────────────
//
// Это НЕ то же, что всё выше. Выше — разовая правка текста в редакторе:
// устаревшая запись переводится в стандартную и такой сохраняется. Здесь —
// обратная подмена, и только НА ПОКАЗ: в базе по-прежнему «G#5» (только
// стандартные имена транспонируются), а читалка подписывает их так, как
// человеку привычнее читать с листа. Настройка общая на все разборы, потому что
// это привычка чтения, а не свойство песни (см. lib/viewerPrefs.ts).
//
// Аппликатура от подмены не двигается: имя «4В» приводит ровно к тем же ладам,
// что и «G#5» (общее правило выбора струны, см. chordNameToPowerFifth).

/**
 * Песня с квинтами, подписанными ладами. Если подписывать нечего, возвращается
 * ТОТ ЖЕ объект — так React не перерисовывает лист там, где ничего не менялось.
 */
export function songWithFretFifths(song: Song): Song {
  let touched = false;

  const sections = song.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line): Line => {
      if (line.type !== 'lyric') return line;
      return {
        ...line,
        segments: line.segments.map((seg) => {
          if (seg.chord === undefined) return seg;
          const renamed = chordNameToPowerFifth(seg.chord);
          if (!renamed) return seg;
          touched = true;
          return { ...seg, chord: renamed };
        }),
      };
    }),
  }));

  return touched ? { meta: song.meta, sections } : song;
}

/**
 * Свои аппликатуры под новыми подписями.
 *
 * Без переименования ключей нарисованная руками форма пропала бы с картинки:
 * формы лежат под именем аккорда, а имя только что сменилось (та же причина, по
 * которой существует `transposeChordDefs`). Вызывать вместе с
 * `songWithFretFifths` — порознь они рассогласуют текст и картинки.
 */
export function defsWithFretFifths(
  defs: Record<string, ChordShape>,
): Record<string, ChordShape> {
  const out: Record<string, ChordShape> = {};
  let touched = false;

  for (const [name, shape] of Object.entries(defs)) {
    const renamed = chordNameToPowerFifth(name);
    if (renamed) touched = true;
    out[renamed ?? name] = shape;
  }

  return touched ? out : defs;
}
