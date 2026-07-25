/**
 * Импорт «аккорды над текстом» → ChordPro.
 *
 * Формат-источник (Ultimate-Guitar, текстовые файлы): строка аккордов,
 * расставленных пробелами так, что каждый аккорд стоит ровно над своим слогом,
 * а под ней — строка текста. Здесь мы читаем колонку каждого аккорда и вставляем
 * `[аккорд]` перед символом текста в этой колонке — получается инлайн-ChordPro
 * редактора. Чистая функция, покрыта тестами.
 */

// Аккорд: корень A–H (+ альтерация), набор «качеств»/цифр, опц. бас.
const ROOT = '[A-H](?:#|b|##|bb)?';
const QUAL = '(?:maj|min|sus|add|dim|aug|M|m|\\+|°|ø|b5|#5|b9|#9|#11|b13|[0-9]+)';
const CHORD_RE = new RegExp(`^${ROOT}(?:${QUAL})*(?:\\/${ROOT})?$`);
// Квинты в нотации «лад+В/Н», которые понимает приложение (напр. 3В, 5Н).
const POWER_RE = /^\d{1,2}[ВНвнBHbh]$/;

function isChordToken(t: string): boolean {
  if (t === 'N.C.' || t === 'NC') return true;
  return CHORD_RE.test(t) || POWER_RE.test(t);
}

/** Строка целиком из аккордов (все токены — аккорды). Пустая — нет. */
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

const SECTIONS: { re: RegExp; dir: string }[] = [
  { re: /^(chorus|припев|hook)\s*\d*$/i, dir: 'start_of_chorus' },
  { re: /^(verse|куплет)\s*\d*$/i, dir: 'start_of_verse' },
  { re: /^(bridge|бридж|мост)\s*\d*$/i, dir: 'start_of_bridge' },
];
const SECTION_COMMENT =
  /^(intro|outro|solo|instrumental|pre-?chorus|вступление|проигрыш|соло|кода|аутро)\s*\d*$/i;

/** Заголовок секции: `[Chorus]`, `[Куплет 2]`, `Припев:` → директива ChordPro. */
function sectionDirective(line: string): string | null {
  const t = line.trim();
  const m = /^\[([^\]]+)\]$/.exec(t) ?? /^(.+?):$/.exec(t);
  const inner = m ? m[1].trim() : null;
  if (!inner) return null;
  if (isChordToken(inner)) return null; // одиночный аккорд в скобках — не секция
  for (const { re, dir } of SECTIONS) if (re.test(inner)) return `{${dir}}`;
  if (SECTION_COMMENT.test(inner)) return `{comment: ${inner}}`;
  return null;
}

function chordPositions(line: string): { col: number; text: string }[] {
  const out: { col: number; text: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push({ col: m.index, text: m[0] });
  return out;
}

/**
 * Вставляет аккорды из строки-аккордов в строку-текст по колонкам.
 * `shift` двигает все аккорды на N символов (± для тонкой подгонки пробелов).
 */
function mergeChordLyric(chordLine: string, lyricLine: string, shift: number): string {
  const chords = chordPositions(chordLine).map((c) => ({
    col: Math.max(0, c.col + shift),
    text: c.text,
  }));
  let result = '';
  let ci = 0;
  for (let pos = 0; pos <= lyricLine.length; pos++) {
    while (ci < chords.length && chords[ci].col <= pos) {
      result += `[${chords[ci].text}]`;
      ci++;
    }
    if (pos < lyricLine.length) result += lyricLine[pos];
  }
  while (ci < chords.length) {
    result += `[${chords[ci].text}]`; // аккорды за концом строки — в конец
    ci++;
  }
  return result;
}

/** Строка только из аккордов (проигрыш) → `[G#] [C] …`. */
function chordsOnly(line: string): string {
  return chordPositions(line)
    .map((c) => `[${c.text}]`)
    .join(' ');
}

/**
 * Конвертирует «аккорды над текстом» в инлайн-ChordPro.
 * `shift` — глобальный сдвиг всех аккордов на N символов (подгонка пробелов).
 */
export function plainToChordPro(text: string, shift = 0): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const sec = sectionDirective(line);
    if (sec) {
      out.push(sec);
      i++;
      continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1];
      const nextIsLyric =
        next !== undefined &&
        next.trim() !== '' &&
        !isChordLine(next) &&
        !sectionDirective(next);
      if (nextIsLyric) {
        out.push(mergeChordLyric(line, next, shift));
        i += 2;
      } else {
        out.push(chordsOnly(line));
        i += 1;
      }
      continue;
    }

    out.push(line);
    i++;
  }
  return out.join('\n');
}
