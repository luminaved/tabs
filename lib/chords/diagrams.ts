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
import { parseChord, transposeChord } from './chord';
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

// ─── Окно грифа ────────────────────────────────────────────────────────────

/**
 * Сколько ладов показывает диаграмма обычному аккорду. Четыре — потому что в
 * них укладывается всё, что играется открытыми и барре-формами.
 */
export const DIAGRAM_MIN_ROWS = 4;

/**
 * Потолок числа ладов на диаграмме — и заодно потолок РАЗМАХА аппликатуры.
 *
 * Здесь была настоящая дыра, а не запас на будущее. Редактор грифа
 * (`EDITOR_FRET_ROWS`) позволял отметить пять ладов, а диаграмма умела ровно
 * четыре и считала позицию точки как `f - base + 1`, никак её не ограничивая.
 * Точка пятого лада получала `pos = 5` и уезжала за нижний край сетки, а
 * дальше её обрезал край viewBox: при размахе 5 она была видна наполовину,
 * при 6 исчезала совсем. Баррэ от этого было защищено (`pos > FRETS` →
 * не рисуем), точки — нет, поэтому человек рисовал форму, видел её в
 * редакторе и не находил на странице разбора.
 *
 * Шесть ладов — потолок и по физике: дальше рука не тянется, а значит форма
 * с бо́льшим размахом либо опечатка, либо мусор из чужого JSON. Такие формы
 * отбраковываются при разборе (см. `isValidFrets`), чтобы в базу не попадало
 * то, что нарисовать нельзя.
 */
export const DIAGRAM_MAX_ROWS = 6;

/**
 * Сколько рядов ладов показывает редактор грифа.
 *
 * Живёт здесь, а не в самом редакторе, ровно затем, чтобы не разъехаться с
 * `DIAGRAM_MAX_ROWS`: расхождение этих двух чисел и было багом. Соотношение
 * закреплено тестом.
 */
export const EDITOR_FRET_ROWS = 5;

/** Размах формы в ладах (открытые и заглушённые струны не считаются). */
export function fretSpan(frets: ChordFrets): number {
  const positives = frets.filter((f) => f > 0);
  if (positives.length === 0) return 0;
  return Math.max(...positives) - Math.min(...positives) + 1;
}

/**
 * Окно грифа для формы: с какого лада рисовать и сколько ладов показать.
 *
 * Вынесено из компонента отдельной функцией, потому что от него зависит и
 * геометрия картинки, и высота холста, и проверка «влезет ли точка» — три
 * места, которые обязаны считать одинаково.
 *
 * Правила:
 *   — форма умещается в первые четыре лада → окно от порожка (`base = 1`),
 *     как было всегда: у обычных аккордов картинка не меняется ни на пиксель;
 *   — иначе окно начинается с самого нижнего прижатого лада и растягивается
 *     ровно на размах формы, но не у́же четырёх ладов и не шире потолка.
 */
export function fretWindow(frets: ChordFrets): { base: number; rows: number } {
  const positives = frets.filter((f) => f > 0);
  if (positives.length === 0) return { base: 1, rows: DIAGRAM_MIN_ROWS };

  const max = Math.max(...positives);
  const base = max > DIAGRAM_MIN_ROWS ? Math.min(...positives) : 1;
  const rows = Math.min(DIAGRAM_MAX_ROWS, Math.max(DIAGRAM_MIN_ROWS, max - base + 1));
  return { base, rows };
}

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

/**
 * Годится ли значение как аппликатура: длина по числу струн, лады в пределах
 * грифа И размах, который диаграмма способна показать.
 *
 * Проверка размаха здесь не формальность. Без неё в базу попадала форма, для
 * которой картинки не существует: точка за пределами окна просто не рисуется
 * (подробности у `DIAGRAM_MAX_ROWS`). Отбраковка на разборе честнее — аккорд
 * покажется как «форма не задана», и это видно сразу, а не как диаграмма с
 * молча пропавшим пальцем.
 */
function isValidFrets(v: unknown, strings: number): v is ChordFrets {
  if (!Array.isArray(v) || v.length !== strings) return false;
  if (!v.every((n) => Number.isInteger(n) && (n as number) >= -1 && (n as number) <= 24)) {
    return false;
  }
  return fretSpan(v as ChordFrets) <= DIAGRAM_MAX_ROWS;
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

/**
 * Разбирает ручной ввод: «x32010», «x 3 2 0 1 0», «-1 3 2 0 1 0». Иначе null.
 *
 * Сейчас ниоткуда не вызывается — ручной ввод формы заменил редактор грифа
 * (components/FretboardEditor.tsx). Оставлена как готовый разбор компактной
 * записи из чужих табов, но с ТЕМ ЖЕ ограничением размаха, что и остальные
 * пути: иначе, когда её однажды подключат, она станет вторым способом завести
 * форму, которую диаграмма не нарисует.
 */
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
  if (frets.some((n) => Number.isNaN(n))) return null;
  return fretSpan(frets) <= DIAGRAM_MAX_ROWS ? frets : null;
}

/**
 * Открытые струны, от которых запись «лад + В/Н» считает корень квинты:
 * 6-я (E) и 5-я (A). Сами формы квинт живут у инструмента
 * ([instruments.ts](./instruments.ts), поле `powerChord`) — здесь только разбор
 * этой записи, а она гитарная по устройству: других струн у неё нет.
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
 * Подпись «лад + В/Н» для формы, которая БУДЕТ НАРИСОВАНА. null — такой формы
 * этой записью не выразить.
 *
 * Считать подпись от ИМЕНИ аккорда недостаточно, и это стоило бага. Имя даёт
 * только высоту корня, а позицию пришлось бы брать из встроенной формы — но
 * встроенную перебивает своя аппликатура с песни, и тогда подпись говорила про
 * одно место грифа, а картинка показывала другое. Живой пример: своя форма
 * A#5 = [6,8,8,×,×,×] (корень на шестой струне, лад 6), встроенная — на пятой
 * струне на первом ладу, и подпись выходила «1Н» под диаграммой шестого лада.
 *
 * Здесь этого разъезда нет по построению: струну не вычисляем заново, а читаем
 * из самой формы.
 *
 * Поэтому спрашиваем сами лады — ровно те, что уйдут в ChordDiagram. Тот же
 * принцип уже записан у `powerFifthPins`: «что нарисовано сейчас, спрашиваем у
 * getChordShape — ровно той функции, которой рисует страница».
 *
 * Форма обязана быть квинтой в привычном виде: две-три СОСЕДНИЕ струны подряд,
 * корень на шестой (В) либо пятой (Н), квинта двумя ладами выше, октава — там
 * же. Всё прочее (корень с четвёртой струны, растянутые и неполные хваты)
 * возвращает null: такую форму запись не описывает, и врать про неё нельзя —
 * аккорд просто останется под стандартным именем.
 */
export function powerFifthLabelForShape(frets: ChordFrets): string | null {
  // Корень — только шестая или пятая струна: других букв у записи нет.
  const root = frets.findIndex((f) => f >= 0);
  if (root !== 0 && root !== 1) return null;

  let last = root;
  while (last + 1 < frets.length && frets[last + 1] >= 0) last++;
  // После хвата — только заглушённые струны. Дырка посреди формы означает, что
  // это не тот хват, который описывает запись.
  for (let i = last + 1; i < frets.length; i++) {
    if (frets[i] >= 0) return null;
  }

  const shape = frets.slice(root, last + 1);
  if (shape.length < 2 || shape.length > 3) return null;

  const fret = shape[0];
  // Те же границы лада, что принимает разбор записи (см. parsePowerFifth):
  // подпись обязана читаться обратно.
  if (fret < 0 || fret > 22) return null;
  if (shape[1] !== fret + 2) return null;
  if (shape.length === 3 && shape[2] !== fret + 2) return null;

  return `${fret}${root === 0 ? 'В' : 'Н'}`;
}

/**
 * Докуда переносится своя аппликатура (см. `transposeShape`). Двенадцатый лад —
 * октава: выше него на укулеле грифа попросту нет, а на гитаре начинается вырез
 * корпуса.
 */
const SHIFT_MAX_FRET = 12;

/**
 * Та же форма, сдвинутая на `semitones` ладов, — аппликатура для песни,
 * которую транспонировали.
 *
 * Возвращает null для форм с ОТКРЫТЫМИ струнами, и это главное здесь. Открытая
 * струна звучит той нотой, на которую настроена, и вместе с рукой никуда не
 * едет: подвинув C-форму с открытой струной на два лада, получишь не D, а
 * созвучие, которого никто не заказывал. Такие формы отдаём встроенным —
 * `getChordShape` найдёт для нового имени свою.
 *
 * Уехавшую за гриф форму возвращаем октавой ниже (или выше — если сдвиг вниз
 * увёл её за порожек): звучит она тем же аккордом, а рукой берётся.
 *
 * А вот когда и октавой ниже не получается — упирается в порожек, — форму не
 * отдаём вовсе (null), и это осознанный выбор в пользу встроенной. Так «D5» с
 * баррэ на 2 ладу, поднятый на восемь полутонов, не превращается в баррэ на
 * 10-м с точками на 13-м (на укулеле такого лада просто нет): встроенная форма
 * посчитана для нового имени и лежит внизу грифа.
 */
export function transposeShape(shape: ChordShape, semitones: number): ChordShape | null {
  if (semitones === 0) return shape;
  if (shape.frets.some((f) => f === 0)) return null;

  const positives = shape.frets.filter((f) => f > 0);
  if (positives.length === 0) return shape; // всё заглушено — двигать нечего

  const min = Math.min(...positives);
  const max = Math.max(...positives);

  let shift = semitones;
  while (min + shift < 1) shift += 12;
  while (max + shift > SHIFT_MAX_FRET && min + shift - 12 >= 1) shift -= 12;
  if (max + shift > SHIFT_MAX_FRET) return null;

  const frets = shape.frets.map((f) => (f < 0 ? -1 : f + shift));
  // Баррэ у своей формы задаёт человек, и его лад в общем случае не обязан
  // совпадать с прижатыми струнами — уехавшую за порожек палку просто убираем.
  const barres = shape.barres?.map((b) => ({ ...b, fret: b.fret + shift })).filter((b) => b.fret >= 1);
  return barres && barres.length ? { frets, barres } : { frets };
}

/**
 * Свои аппликатуры песни, перенесённые вместе с ней на `semitones` полутонов:
 * ключи получают новые имена аккордов, формы — новые лады.
 *
 * Без этого транспонирование ломало ровно те разборы, ради которых свои формы
 * и рисуют. Формы лежат под именем аккорда («D5»), а транспонирование это имя
 * меняет («E5») — и страница переставала находить форму вовсе: диаграмма
 * молча исчезала, стоило нажать «+». Особенно заметно это было на укулеле, где
 * до появления встроенных квинт своими были ВСЕ формы power-аккордов.
 *
 * Написание нот (диез/бемоль) задаётся снаружи — тем же, каким подписаны
 * аккорды в тексте (см. `songAccidental` в lib/chordpro/transform.ts): иначе
 * форма осталась бы под «A#5», когда в песне уже «Bb5».
 */
export function transposeChordDefs(
  defs: Record<string, ChordShape>,
  semitones: number,
  accidental: Accidental,
): Record<string, ChordShape> {
  if (semitones === 0) return defs;

  const out: Record<string, ChordShape> = {};
  for (const [name, shape] of Object.entries(defs)) {
    // Не аккорд («5В», «N.C.») — в тексте песни такое имя тоже остаётся на
    // месте, значит и форма остаётся под ним же.
    if (!parseChord(name)) {
      out[name] = shape;
      continue;
    }
    const moved = transposeShape(shape, semitones);
    if (!moved) continue; // с открытыми струнами — пусть берётся встроенная
    out[transposeChord(name, semitones, accidental)] = moved;
  }
  return out;
}

/**
 * Значение из таблицы форм по имени аккорда — только СВОЁ свойство.
 *
 * Не перестраховка. Имя аккорда приходит из текста песни как есть: в аккорды
 * попадает всё, что стоит в квадратных скобках (см. `chordsInOrder`), — а
 * таблицы форм и словарь своих аппликатур это обычные объектные литералы.
 * Значит `[constructor]`, `[toString]`, `[valueOf]` или `[__proto__]` в тексте
 * возвращали не форму, а унаследованное свойство прототипа: истинное, поэтому
 * все проверки его пропускали, и `deriveBarres` падал на нём с «frets.map is
 * not a function». Одна такая строчка роняла И редактор (он ищет формы на
 * каждый штрих, см. SongEditor), И страницу разбора.
 *
 * Своим свойством закрыт весь класс сразу — независимо от того, каким объектом
 * пришёл словарь: их собирают в четырёх местах (parseChordDefs,
 * transposeChordDefs, powerFifthPins, ChordDefsEditor).
 */
function ownEntry<T>(table: Record<string, T> | undefined, key: string): T | undefined {
  if (!table || !Object.hasOwn(table, key)) return undefined;
  return table[key];
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
  const own = ownEntry(customDefs, trimmed);
  if (own) return own;

  const base = trimmed.split('/')[0]; // бас в slash-аккорде для диаграммы игнорируем
  const ownBase = ownEntry(customDefs, base);
  if (ownBase) return ownBase;

  if (inst.fifthShorthand) {
    // Устаревшая запись «5В». Оставлена, чтобы вставленные табы рисовались;
    // сохранять её в новых разборах не нужно — см. `powerFifthToChordName`.
    const power = parsePowerFifth(base);
    if (power) return builtin(powerFifthFrets(power));
  }

  const open = ownEntry(inst.openShapes, base);
  if (open) return builtin(open);

  const m = /^([A-G][#b]*)(.*)$/.exec(base);
  if (!m) return null;
  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;

  // Квинта («A5») — до таблицы подвижных форм: опорная струна у неё меняется
  // вместе с корнем, а таблица знает только одну (см. `Instrument.powerChord`).
  if (m[2] === '5' && inst.powerChord) return inst.powerChord(rootPc);

  // `[Aconstructor]` попадало сюда же: корень разбирался, а суффикс уходил в
  // таблицу подвижных форм и приносил оттуда `Object` вместо функции.
  const gen = ownEntry(inst.movableShapes, m[2]);
  if (!gen) return null;

  return builtin(gen(mod12(rootPc - inst.movableRootPc)));
}
