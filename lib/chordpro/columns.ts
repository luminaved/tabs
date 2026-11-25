/**
 * Раскладка строки текста в «колонки» для рендера аккордов над слогами.
 *
 * Каждая колонка = один inline-block элемент (аккорд сверху, слог снизу).
 * Перенос строки происходит МЕЖДУ колонками по пробелам (`spaceAfter`),
 * а не внутри слова — поэтому аккорд, попавший в середину слова, остаётся
 * приклеенным к своему слогу и не «разъезжается» на узком экране.
 *
 * Серый текст: участок между знаками `%` (напр. `%проигрыш%`) помечается
 * `muted` — сами `%` убираются. Состояние сбрасывается на каждой строке.
 *
 * Чистый модуль без зависимостей от UI.
 */

import { Segment } from './types';

export interface Column {
  /** Аккорд над слогом, если есть. */
  chord?: string;
  /** Текст слога/слова (без внутренних пробелов). */
  text: string;
  /** Серый (приглушённый) текст — участок между `%…%`. */
  muted?: boolean;
  /** После колонки идёт пробел — допустимая точка переноса. */
  spaceAfter: boolean;
}

/**
 * Строка как есть — для секций табулатуры (`{start_of_tab}`).
 *
 * В табах значение имеет каждый пробел: `e|--3--5--|` держится только на
 * выравнивании, поэтому колоночная раскладка (она режет строку по словам и
 * рисует пропорциональным шрифтом) для них не годится. Здесь текст сегментов
 * склеивается обратно, аккорды возвращаются в квадратных скобках, а `%`
 * остаются символами — в табах это не разметка серого текста.
 */
export function lineToPlainText(segments: Segment[]): string {
  let out = '';
  for (const seg of segments) {
    if (seg.chord !== undefined) out += `[${seg.chord}]`;
    out += seg.text ?? '';
  }
  return out;
}

export function lineToColumns(segments: Segment[]): Column[] {
  const cols: Column[] = [];
  let muted = false;

  const markSpace = (): void => {
    if (cols.length) cols[cols.length - 1].spaceAfter = true;
  };

  for (const seg of segments) {
    const chord = seg.chord;
    const text = seg.text ?? '';
    let chordUsed = false;
    let buf = '';

    const flush = (): void => {
      if (buf === '') return;
      const col: Column = { text: buf, spaceAfter: false };
      if (muted) col.muted = true;
      if (!chordUsed && chord !== undefined) {
        col.chord = chord;
        chordUsed = true;
      }
      cols.push(col);
      buf = '';
    };

    for (const ch of text) {
      if (ch === '%') {
        flush();
        muted = !muted;
      } else if (/\s/.test(ch)) {
        flush();
        markSpace();
      } else {
        buf += ch;
      }
    }
    flush();

    // Аккорд без текста (напр. в конце строки) — самостоятельная колонка.
    if (!chordUsed && chord !== undefined) {
      const col: Column = { chord, text: '', spaceAfter: false };
      if (muted) col.muted = true;
      cols.push(col);
    }
  }

  return cols;
}
