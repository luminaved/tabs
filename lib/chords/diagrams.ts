/**
 * Поиск аппликатуры аккорда для конкретного инструмента.
 *
 * Строй, число струн и таблицы форм живут в [instruments.ts](./instruments.ts);
 * здесь — только правила поиска и разбор пользовательских форм.
 *
 * Приоритет: кастомные (заданы на песне) → встроенные открытые → подвижная
 * (барре) форма для major/m/7/m7/maj7. Так стандартные аккорды получают
 * аппликатуру автоматически, а руками задаём только необычные.
 */

import { mod12, noteToPc } from './pitch';
import {
  getInstrument,
  type Barre,
  type ChordFrets,
  type ChordShape,
  type Instrument,
  type InstrumentId,
} from './instruments';

export type { ChordFrets, Barre, ChordShape } from './instruments';

/**
 * Инструмент можно передать объектом или идентификатором. Тип намеренно узкий
 * (а не `string`): иначе легко перепутать аргументы и молча отдать в параметр
 * инструмента словарь кастомных форм.
 */
type InstrumentArg = Instrument | InstrumentId | null;

function resolve(arg: InstrumentArg): Instrument {
  return typeof arg === 'object' && arg ? arg : getInstrument(arg);
}

/**
 * Выводит баррэ из формы: указательный палец лежит на минимальном ладу и
 * прижимает крайние звучащие струны. Признак — минимальный лад стоит и на
 * первой, и на последней звучащей струне; открытых струн в форме нет.
 * Так F, Bm и все подвижные формы рисуются палкой, а C/G/Am (с открытыми)
 * и квинты — точками. Применяется только к встроенным формам: у своих
 * аппликатур баррэ задаёт пользователь.
 */
export function deriveBarres(frets: ChordFrets): Barre[] {
  const sounding = frets.map((f, i) => ({ f, i })).filter(({ f }) => f >= 0);
  if (sounding.length < 2) return [];
  if (sounding.some(({ f }) => f === 0)) return []; // открытые струны — не баррэ

  const first = sounding[0];
  const last = sounding[sounding.length - 1];
  const min = Math.min(...sounding.map(({ f }) => f));
  if (first.f !== min || last.f !== min) return [];
  return [{ fret: min, from: first.i, to: last.i }];
}

/** Встроенная форма → ChordShape с автоматически выведенным баррэ. */
function builtin(frets: ChordFrets): ChordShape {
  const barres = deriveBarres(frets);
  return barres.length ? { frets, barres } : { frets };
}

function isValidFrets(v: unknown, strings: number): v is ChordFrets {
  return (
    Array.isArray(v) &&
    v.length === strings &&
    v.every((n) => Number.isInteger(n) && (n as number) >= -1 && (n as number) <= 24)
  );
}

/** Нормализует баррэ из JSON (валидирует лад/струны, сортирует from<to). */
function parseBarres(v: unknown, strings: number): Barre[] {
  if (!Array.isArray(v)) return [];
  const out: Barre[] = [];
  for (const b of v) {
    if (!b || typeof b !== 'object') continue;
    const { fret, from, to } = b as Record<string, unknown>;
    if (![fret, from, to].every((n) => Number.isInteger(n))) continue;
    const f = fret as number;
    const lo = Math.min(from as number, to as number);
    const hi = Math.max(from as number, to as number);
    if (f < 1 || f > 24 || lo < 0 || hi > strings - 1 || lo === hi) continue;
    out.push({ fret: f, from: lo, to: hi });
  }
  return out;
}

/** Приводит значение аппликатуры: легаси-массив либо объект {frets, barres}. */
function coerceShape(v: unknown, strings: number): ChordShape | null {
  if (isValidFrets(v, strings)) return { frets: v };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const f = (v as Record<string, unknown>).frets;
    if (!isValidFrets(f, strings)) return null;
    const barres = parseBarres((v as Record<string, unknown>).barres, strings);
    return barres.length ? { frets: f, barres } : { frets: f };
  }
  return null;
}

/**
 * Безопасно разбирает JSON кастомных аппликатур с песни.
 *
 * Формы с чужим числом струн отбрасываются: если у песни сменили инструмент,
 * старые шестиструнные формы к четырём струнам не подходят — вместо кривой
 * диаграммы честно показываем, что форму нужно задать заново.
 */
export function parseChordDefs(
  json: string | null | undefined,
  instrument: InstrumentArg = null,
): Record<string, ChordShape> {
  if (!json) return {};
  const inst = resolve(instrument);
  try {
    const obj: unknown = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return {};
    const out: Record<string, ChordShape> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const shape = coerceShape(v, inst.strings);
      if (shape) out[k] = shape;
    }
    return out;
  } catch {
    return {};
  }
}

/** Разбирает ручной ввод: «x32010», «x 3 2 0 1 0», «-1 3 2 0 1 0». Иначе null. */
export function parseFrets(input: string, strings = 6): ChordFrets | null {
  const s = input.trim();
  if (!s) return null;
  let parts: string[];
  if (/[\s,]/.test(s) || s.includes('-')) {
    parts = s.split(/[\s,]+/).filter(Boolean);
  } else {
    parts = s.split(''); // компактный вид «x32010» (лады 0..9)
  }
  if (parts.length !== strings) return null;
  const frets = parts.map((p) => {
    if (p === 'x' || p === 'X' || p === '-' || p === '-1') return -1;
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 24 ? n : NaN;
  });
  return frets.some((n) => Number.isNaN(n)) ? null : frets;
}

/**
 * Квинты (power chords) в нотации «лад + В/Н» — гитарная запись из русских
 * табов:
 *   NВ — верхняя квинта, корень на 6-й струне: [N, N+2, N+2, x, x, x];
 *   NН — нижняя квинта, та же форма на струну тоньше (5/4/3).
 * Принимаем кириллицу (В/Н) и латинские двойники (B/H), любой регистр.
 */
function parsePowerFifth(name: string): ChordFrets | null {
  const m = /^(\d{1,2})([ВНвнBHbh])$/.exec(name);
  if (!m) return null;
  const fret = Number(m[1]);
  if (fret < 1 || fret > 22) return null;
  const upper = /[ВвBb]/.test(m[2]);
  return upper
    ? [fret, fret + 2, fret + 2, -1, -1, -1]
    : [-1, fret, fret + 2, fret + 2, -1, -1];
}

/**
 * Аппликатура по имени аккорда для инструмента. customDefs (с песни) — главнее.
 * Возвращает null, если формы нет (нужно задать вручную).
 */
export function getChordShape(
  name: string,
  instrument: InstrumentArg = null,
  customDefs?: Record<string, ChordShape>,
): ChordShape | null {
  const inst = resolve(instrument);

  const trimmed = name.trim();
  if (!trimmed) return null;
  if (customDefs && customDefs[trimmed]) return customDefs[trimmed];

  const base = trimmed.split('/')[0]; // бас в slash-аккорде для диаграммы игнорируем
  if (customDefs && customDefs[base]) return customDefs[base];

  if (inst.powerChords) {
    const power = parsePowerFifth(base);
    if (power) return builtin(power);
  }

  if (inst.openShapes[base]) return builtin(inst.openShapes[base]);

  const m = /^([A-G][#b]*)(.*)$/.exec(base);
  if (!m) return null;
  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;
  const gen = inst.movableShapes[m[2]];
  if (!gen) return null;

  return builtin(gen(mod12(rootPc - inst.movableRootPc)));
}
