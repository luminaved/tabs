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

import { mod12, noteToPc, pcToName, type Accidental } from './pitch';
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
 * Открытые струны, на которых стоит корень квинты: 6-я (E) и 5-я (A).
 * Отсюда считается и лад по имени аккорда, и имя аккорда по ладу.
 */
const SIXTH_STRING_PC = 4; // E
const FIFTH_STRING_PC = 9; // A

/**
 * Разобранная запись квинты «лад + В/Н».
 *
 * Отдельным типом, а не сразу аппликатурой, потому что у этой записи два
 * потребителя с разными нуждами: диаграмме нужны лады, а переименованию
 * (см. `powerFifthToChordName`) — высота корня.
 */
export interface PowerFifthRef {
  /** Лад, на котором стоит корень. */
  fret: number;
  /** Корень на 6-й струне («В») — иначе на 5-й («Н»). */
  upper: boolean;
}

/**
 * Квинты (power chords) в нотации «лад + В/Н» — гитарная запись из русских
 * табов:
 *   NВ — верхняя квинта, корень на 6-й струне: [N, N+2, N+2, x, x, x];
 *   NН — нижняя квинта, та же форма на струну тоньше (5/4/3).
 * Принимаем кириллицу (В/Н) и латинские двойники (B/H), любой регистр.
 *
 * ЗАПИСЬ УСТАРЕЛА: она читается только внутри этой традиции, а главное — её не
 * понимает разбор аккордов (см. lib/chords/chord.ts), который ждёт корень A-G.
 * Значит такой аккорд молча НЕ транспонируется: тональность песни едет, а он
 * стоит на месте. Правильное имя — «A5», «C5»; эта функция оставлена, чтобы
 * вставленные откуда-то табы всё же рисовались, а редактор мог предложить
 * замену (см. `powerFifthToChordName`).
 */
export function parsePowerFifth(name: string): PowerFifthRef | null {
  const m = /^(\d{1,2})([ВНвнBHbh])$/.exec(name.trim());
  if (!m) return null;
  const fret = Number(m[1]);
  // Ноль допустим: это открытая струна, то есть E5 («0В») и A5 («0Н») — самые
  // ходовые квинты, какие есть. Раньше здесь стояло `fret < 1`, и они молча
  // оставались без аппликатуры: снаружи это выглядело как «сайт не знает
  // такого аккорда», а на деле форму приходилось рисовать руками.
  if (fret < 0 || fret > 22) return null;
  return { fret, upper: /[ВвBb]/.test(m[2]) };
}

/** Аппликатура ровно для той позиции, которую задаёт запись «лад + В/Н». */
function powerFifthFrets({ fret, upper }: PowerFifthRef): ChordFrets {
  return upper
    ? [fret, fret + 2, fret + 2, -1, -1, -1]
    : [-1, fret, fret + 2, fret + 2, -1, -1];
}

/**
 * Стандартное имя аккорда для записи «лад + В/Н»: «5В» → «A5», «7Н» → «E5».
 * Возвращает null, если это не такая запись.
 *
 * Написание ноты задаётся снаружи: диез или бемоль — вопрос тональности песни,
 * а не самого аккорда (тот же принцип, что в lib/chords/chord.ts).
 *
 * ВНИМАНИЕ: перевод односторонний. Имя несёт высоту корня, но не позицию, и
 * «5В» с «17В» дают одно и то же «A5». Где позиция важна, её задают
 * аппликатурой на песне (chordDefs) — она главнее встроенных форм.
 */
export function powerFifthToChordName(name: string, accidental: Accidental = 'sharp'): string | null {
  const ref = parsePowerFifth(name);
  if (!ref) return null;
  const open = ref.upper ? SIXTH_STRING_PC : FIFTH_STRING_PC;
  return pcToName(mod12(open + ref.fret), accidental) + '5';
}

/**
 * Аппликатура квинты по высоте корня — то, чем рисуются «A5», «C5», «F#5».
 *
 * Струну корня выбираем так, как её берут в руки: до пятого лада — шестая
 * струна, дальше — пятая. Выше пятого лада форма от шестой струны уводит руку
 * в неудобную позицию, и гитаристы там переходят на струну тоньше.
 *
 * Порог именно 5, а не 7: на A5 обе позиции равноценны (5 лад шестой струны
 * либо открытая пятая), и выбран первый — он звучит полнее. Побочный, но
 * важный эффект: правило один в один воспроизводит прежнюю запись «лад + В/Н»
 * для всех ходовых позиций, поэтому переименование старых разборов не меняет
 * им картинки (закреплено таблицей в тестах).
 *
 * Отдельной веткой, а не строкой в `movableShapes`: та таблица умеет ровно одну
 * опорную струну (`movableRootPc`), а здесь их две.
 */
export function powerChordFrets(rootPc: number): ChordFrets {
  const sixth = mod12(rootPc - SIXTH_STRING_PC);
  if (sixth <= 5) return [sixth, sixth + 2, sixth + 2, -1, -1, -1];
  const fifth = mod12(rootPc - FIFTH_STRING_PC);
  return [-1, fifth, fifth + 2, fifth + 2, -1, -1];
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
    // Устаревшая запись «5В». Оставлена, чтобы вставленные табы рисовались;
    // сохранять её в новых разборах не нужно — см. `powerFifthToChordName`.
    const power = parsePowerFifth(base);
    if (power) return builtin(powerFifthFrets(power));
  }

  if (inst.openShapes[base]) return builtin(inst.openShapes[base]);

  const m = /^([A-G][#b]*)(.*)$/.exec(base);
  if (!m) return null;
  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;

  // Квинта («A5») — до таблицы подвижных форм: у неё корень стоит то на 6-й
  // струне, то на 5-й, а таблица знает только одну опорную.
  if (m[2] === '5' && inst.powerChords) return builtin(powerChordFrets(rootPc));

  const gen = inst.movableShapes[m[2]];
  if (!gen) return null;

  return builtin(gen(mod12(rootPc - inst.movableRootPc)));
}
