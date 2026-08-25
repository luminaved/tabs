/**
 * Тональности, выбор диез/бемоль и капо.
 *
 * Ключевое требование: написание нот зависит от ЦЕЛЕВОЙ тональности —
 * в Bb-мажоре нота на 10-м полутоне пишется как `Bb`, а не `A#`.
 *
 * Таблицы предпочтительных имён тональностей и функция `accidentalForKey`
 * внутренне согласованы по кругу квинт (относительный минор мажора берёт
 * то же написание): напр. Gb-мажор ↔ Ebm — обе бемольные.
 */

import { Accidental, mod12, noteToPc, pcToName } from './pitch';
import { parseChord } from './chord';

export interface Key {
  tonicPc: number;
  minor: boolean;
  /** Исходная строка тональности как её записали. */
  name: string;
}

// Предпочтительное имя тональности для каждой из 12 высот тоники.
// Чёрные клавиши — через бемоль (распространённая гитарная конвенция).
const MAJOR_BY_PC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_BY_PC = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

// Натуральные (без знака в названии) тональности, которые всё же бемольные.
const NATURAL_FLAT_MAJORS = new Set(['F']);
const NATURAL_FLAT_MINORS = new Set(['C', 'D', 'F', 'G']);

/** Разбирает тональность: «Am», «Bb», «F#m», «Cminor». */
export function parseKey(name: string): Key | null {
  const m = /^([A-G][#b]*)(m|min|minor)?$/.exec(name.trim());
  if (!m) return null;
  const tonicPc = noteToPc(m[1]);
  if (tonicPc === null) return null;
  return { tonicPc, minor: m[2] !== undefined, name: name.trim() };
}

/**
 * Диез или бемоль для данной тональности.
 * Знак в самом названии имеет приоритет; для натуральных — по кругу квинт.
 */
export function accidentalForKey(name: string): Accidental {
  const key = parseKey(name);
  if (!key) return 'sharp';
  if (key.name.includes('b')) return 'flat';
  if (key.name.includes('#')) return 'sharp';
  const letter = key.name[0];
  const flats = key.minor ? NATURAL_FLAT_MINORS : NATURAL_FLAT_MAJORS;
  return flats.has(letter) ? 'flat' : 'sharp';
}

/**
 * Название тональности после сдвига на `semitones` полутонов —
 * с предпочтительным написанием целевой тональности.
 */
export function transposeKey(name: string, semitones: number): string {
  const key = parseKey(name);
  if (!key) return name;
  const pc = mod12(key.tonicPc + semitones);
  return key.minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc];
}

// Ступени и качества трезвучий: мажор и натуральный минор.
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUAL = ['', 'm', 'm', '', '', 'm', 'dim'];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUAL = ['m', 'dim', '', 'm', 'm', '', ''];

/**
 * Диатонические трезвучия тональности — для палитры быстрой вставки.
 * Напр. Am → [Am, Bdim, C, Dm, Em, F, G]. Неизвестная тональность → [].
 */
export function diatonicChords(name: string): string[] {
  const key = parseKey(name);
  if (!key) return [];
  const acc = accidentalForKey(name);
  const steps = key.minor ? MINOR_STEPS : MAJOR_STEPS;
  const qual = key.minor ? MINOR_QUAL : MAJOR_QUAL;
  return steps.map((s, i) => pcToName(mod12(key.tonicPc + s), acc) + qual[i]);
}

/*
 * Здесь была `capoShapeShift(transpose, capo) = transpose - capo` — «сдвиг
 * аппликатур при капо». Она не вызывалась ниоткуда и была удалена вместе с
 * тестом, и это не уборка ради уборки.
 *
 * Формула считала сдвиг ОТ ИСХОДНО ЗАПИСАННЫХ аккордов, а конвейер страницы
 * устроен иначе: `transposeSong` (lib/chordpro/transform.ts) переписывает
 * имена аккордов ещё до того, как их увидит диаграмма, то есть транспонирование
 * в них уже учтено. Тот, кто однажды подключил бы эту функцию к диаграммам,
 * получил бы двойной сдвиг — и заметил бы это не сразу, потому что при нулевом
 * капо и нулевом транспонировании всё выглядит правильно.
 *
 * Капо теперь хранится и показывается (колонка `Song.capo`, поле в редакторе,
 * строка под шапкой разбора), но на аппликатуры НЕ влияет: имена аккордов на
 * странице — реальное звучание, и диаграмма показывает форму именно для него.
 * Если решите показывать формы «как под капо», это отдельная и осознанная
 * работа: понадобится решить, что делать с кастомными аппликатурами, которые
 * заданы по написанному имени аккорда.
 */

// ─── Определение тональности по набору аккордов ────────────────────────────

/**
 * Тональность разбора, выведенная из его аккордов, — либо null, если уверенно
 * сказать нельзя.
 *
 * ── Зачем ───────────────────────────────────────────────────────────────────
 *
 * Колонка `Song.key` есть, поле в редакторе есть, а заполнена она НИ У ОДНОЙ
 * песни. Из-за этого: панель читалки показывает «±0» вместо ноты, описание в
 * выдаче обещает тональность и молчит, а `musicalKey` в структурированных
 * данных пуст. Плюс написание нот при транспонировании по умолчанию уходит в
 * диезы, хотя половине разборов идут бемоли (см. `accidentalForKey`).
 *
 * Считаем НА ЛЕТУ и в базу не пишем: заданная автором тональность остаётся
 * главнее, а выведенная — подсказка, которая обязана уметь ошибаться молча.
 *
 * ── Почему это не тривиально ────────────────────────────────────────────────
 *
 * Сорок разборов из шестидесяти девяти собраны ЦЕЛИКОМ на квинтах, а у квинты
 * нет терции — то есть нет и лада. «B5 G5 D5 A5» одинаково хорошо ложится и в
 * G-мажор, и в Em: у относительных тональностей состав гаммы совпадает
 * ПОЛНОСТЬЮ, и никакой подсчёт попаданий их не различит. Различает только то,
 * вокруг какой ноты песня вращается, — и лучший доступный признак этого
 * последний аккорд: им песня разрешается. Если и он не указывает ни на одну из
 * двух тоник, честнее вернуть null, чем угадать.
 */

/** Сколько очков даёт каждый признак. Подобрано на живом каталоге. */
const SCORE = {
  /** За каждый РАЗНЫЙ корень, легший в гамму. */
  inScale: 3,
  /** Корень в гамму не лёг — это дороже, чем просто «не плюс». */
  outOfScale: -4,
  /** Качество тонического аккорда совпало с ладом (мажор в мажоре, m в миноре). */
  tonicQuality: 4,
  /** Последний аккорд — тоника: песня им разрешается. */
  endsOnTonic: 5,
  /** Первый аккорд — тоника. */
  startsOnTonic: 2,
  /** Потолок надбавки за то, как часто тоника вообще звучит (см. ниже). */
  tonicWeight: 6,
} as const;

/**
 * Насколько победитель обязан оторваться от второго места.
 *
 * Без запаса функция уверенно называла бы тональность там, где данных на это
 * нет, — а неверная тональность в описании выдачи хуже отсутствующей. Особенно
 * это касается относительных тональностей: у C и Am состав гаммы совпадает
 * полностью, и различает их только тонический акцент.
 */
const MIN_MARGIN = 3;

/** Что аккорд сообщает о ладе: трезвучие говорит, квинта — молчит. */
function triadMode(quality: string): 'major' | 'minor' | null {
  if (quality === '') return 'major';
  // «m», «m7», «m9»… — минор. «maj7» начинается на те же буквы, но мажорный.
  if (/^m(?!aj)/.test(quality)) return 'minor';
  return null;
}

/** Разобранная песня в виде, удобном для перебора двадцати четырёх тональностей. */
interface Profile {
  /** Сколько раз прозвучал каждый корень. */
  counts: Map<number, number>;
  /** Лады, в которых встречался корень как трезвучие. */
  modes: Map<number, Set<'major' | 'minor'>>;
  total: number;
  firstPc: number;
  lastPc: number;
}

function scoreKey(tonicPc: number, minor: boolean, p: Profile): number {
  const steps = minor ? MINOR_STEPS : MAJOR_STEPS;
  const scale = new Set(steps.map((s) => mod12(tonicPc + s)));

  let score = 0;
  for (const pc of p.counts.keys()) {
    score += scale.has(pc) ? SCORE.inScale : SCORE.outOfScale;
  }

  /*
   * Надбавка за тонический акцент — по ДОЛЕ звучания, а не за каждое
   * повторение.
   *
   * Считать «плюс столько-то на каждое появление» нельзя: в песне с двадцатью
   * повторами припева тоника набирала бы сотню очков, порог MIN_MARGIN
   * обесценивался, и относительные тональности начинали расходиться случайно.
   * Доля же ограничена сверху по построению, поэтому веса остаются
   * соизмеримыми между собой.
   */
  const share = (p.counts.get(tonicPc) ?? 0) / p.total;
  score += Math.round(SCORE.tonicWeight * share);

  const modes = p.modes.get(tonicPc);
  if (modes?.has(minor ? 'minor' : 'major')) score += SCORE.tonicQuality;

  if (p.lastPc === tonicPc) score += SCORE.endsOnTonic;
  if (p.firstPc === tonicPc) score += SCORE.startsOnTonic;
  return score;
}

/**
 * Тональность по аккордам песни. Аккорды, которые не разбираются («N.C.»,
 * мусор), пропускаются.
 *
 * Список ждём В ПОРЯДКЕ ЗВУЧАНИЯ И С ПОВТОРАМИ (`chordSequence` в
 * lib/chordpro/usedChords.ts). Денормализованная колонка `Song.chords` для
 * этого не годится: она хранит аккорды без повторов, по первому появлению, —
 * то есть последним в ней стоит не тот аккорд, которым песня кончается, а тот,
 * который позже всех появился впервые. На таком «последнем» разбор «G D Em C»
 * объявлял тоникой C, хотя песня очевидно в G.
 *
 * Написание тоники берётся у самой песни: если её аккорды записаны диезами,
 * тональность тоже называем через диез. Иначе разбор на «A# F#» получал бы
 * тональность «Gb» — та же высота, но чужая запись, а от неё зависит и то,
 * как будут подписаны аккорды после транспонирования.
 */
export function detectKey(chords: readonly string[]): string | null {
  const counts = new Map<number, number>();
  const modes = new Map<number, Set<'major' | 'minor'>>();
  let firstPc = -1;
  let lastPc = -1;
  let total = 0;

  for (const name of chords) {
    const chord = parseChord(name);
    // Бас slash-аккорда намеренно игнорируем: он говорит о голосоведении, а не
    // о тональности, и «C/G» — это всё ещё C.
    if (!chord) continue;
    const pc = chord.rootPc;
    counts.set(pc, (counts.get(pc) ?? 0) + 1);
    const mode = triadMode(chord.quality);
    if (mode) {
      const set = modes.get(pc) ?? new Set<'major' | 'minor'>();
      set.add(mode);
      modes.set(pc, set);
    }
    if (firstPc < 0) firstPc = pc;
    lastPc = pc;
    total++;
  }

  // Меньше двух разных корней — говорить не о чем: одна нота ложится куда угодно.
  if (counts.size < 2) return null;

  const profile: Profile = { counts, modes, total, firstPc, lastPc };
  let best = { name: '', score: -Infinity };
  let runnerUp = -Infinity;

  for (let pc = 0; pc < 12; pc++) {
    for (const minor of [false, true]) {
      const score = scoreKey(pc, minor, profile);
      if (score > best.score) {
        runnerUp = best.score;
        best = { name: minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc], score };
      } else if (score > runnerUp) {
        runnerUp = score;
      }
    }
  }

  if (best.score - runnerUp < MIN_MARGIN) return null;
  return respell(best.name, chords);
}

/**
 * Приводит написание тоники к тому, которым записана сама песня.
 * `MAJOR_BY_PC`/`MINOR_BY_PC` предпочитают бемоли, а разборы сплошь и рядом
 * написаны диезами — «Gb» под песней из «A# F#» читается как чужая.
 */
function respell(name: string, chords: readonly string[]): string {
  if (!name.includes('b')) return name;
  let sharps = 0;
  let flats = 0;
  for (const c of chords) {
    if (c.includes('#')) sharps++;
    else if (/^[A-G]b/.test(c)) flats++;
  }
  if (sharps <= flats) return name;
  const key = parseKey(name);
  if (!key) return name;
  return pcToName(key.tonicPc, 'sharp') + (key.minor ? 'm' : '');
}
