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
import { powerFifthToChordName } from '../chords/diagrams';
import { accidentalForKey } from '../chords/key';

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
  if (!getInstrument(instrument).powerChords) return [];
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
 * одно и то же «A5». В редакторе это осознанный размен — человек видит текст и
 * может задать позицию аппликатурой. Для уже существующих разборов позиция
 * сохраняется отдельно (scripts/normalize-power-chords.mjs).
 */
export function normalizePowerFifths(
  body: string,
  key?: string | null,
  instrument?: InstrumentId | null,
): string {
  if (!getInstrument(instrument).powerChords) return body;
  const accidental = accidentalFor(key);
  return body.replace(CHORD_TOKEN_RE, (full, inner: string) => {
    const to = powerFifthToChordName(inner.trim(), accidental);
    return to ? `[${to}]` : full;
  });
}
