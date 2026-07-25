/**
 * Аппликатуры аккордов (гитара, 6 струн).
 *
 * Форма — массив из 6 чисел, от НИЖНЕЙ (толстой, 6-я) струны к верхней (1-я):
 *   -1 = не звучит (x), 0 = открытая, N = лад.
 *
 * Приоритет поиска: кастомные (заданы на песне) → встроенные open-аккорды →
 * генерируемая барре-форма (для major/m/7/m7/maj7). Так стандартные аккорды
 * получают аппликатуру автоматически, а руками задаём только необычные.
 */

import { mod12, noteToPc } from './pitch';

export type ChordFrets = number[]; // длина 6

/** Баррэ: горизонтальная палка на ладу `fret` через струны from..to (0=6-я). */
export interface Barre {
  fret: number; // абсолютный лад (>= 1)
  from: number; // индекс струны 0..5 (0 = 6-я/толстая), from < to
  to: number;
}

/**
 * Аппликатура: лады по струнам + опциональные баррэ (для рендера палки).
 * Кастомные формы на песне могут задавать баррэ; сгенерированные/встроенные —
 * пока рисуются точками (barres не задаётся).
 */
export interface ChordShape {
  frets: ChordFrets;
  barres?: Barre[];
}

// Ходовые открытые аккорды (от 6-й струны к 1-й).
const OPEN_SHAPES: Record<string, ChordFrets> = {
  C: [-1, 3, 2, 0, 1, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  D7: [-1, -1, 0, 2, 1, 2],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fm: [1, 3, 3, 1, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Bm: [-1, 2, 4, 4, 3, 2],
  B: [-1, 2, 4, 4, 4, 2],
};

// Открытая 6-я струна = E (pc 4). Барре-форма E-типа, сдвинутая на f ладов.
const E_SHAPES: Record<string, (f: number) => ChordFrets> = {
  '': (f) => [f, f + 2, f + 2, f + 1, f, f],
  m: (f) => [f, f + 2, f + 2, f, f, f],
  '7': (f) => [f, f + 2, f, f + 1, f, f],
  m7: (f) => [f, f + 2, f, f, f, f],
  maj7: (f) => [f, f + 2, f + 1, f + 1, f, f],
};

function isValidFrets(v: unknown): v is ChordFrets {
  return (
    Array.isArray(v) &&
    v.length === 6 &&
    v.every((n) => Number.isInteger(n) && (n as number) >= -1 && (n as number) <= 24)
  );
}

/** Нормализует баррэ из JSON (валидирует лад/струны, сортирует from<to). */
function parseBarres(v: unknown): Barre[] {
  if (!Array.isArray(v)) return [];
  const out: Barre[] = [];
  for (const b of v) {
    if (!b || typeof b !== 'object') continue;
    const { fret, from, to } = b as Record<string, unknown>;
    if (![fret, from, to].every((n) => Number.isInteger(n))) continue;
    const f = fret as number;
    const lo = Math.min(from as number, to as number);
    const hi = Math.max(from as number, to as number);
    if (f < 1 || f > 24 || lo < 0 || hi > 5 || lo === hi) continue;
    out.push({ fret: f, from: lo, to: hi });
  }
  return out;
}

/** Приводит значение аппликатуры: легаси-массив либо объект {frets, barres}. */
function coerceShape(v: unknown): ChordShape | null {
  if (isValidFrets(v)) return { frets: v };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const f = (v as Record<string, unknown>).frets;
    if (!isValidFrets(f)) return null;
    const barres = parseBarres((v as Record<string, unknown>).barres);
    return barres.length ? { frets: f, barres } : { frets: f };
  }
  return null;
}

/** Безопасно разбирает JSON кастомных аппликатур с песни. */
export function parseChordDefs(json: string | null | undefined): Record<string, ChordShape> {
  if (!json) return {};
  try {
    const obj: unknown = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return {};
    const out: Record<string, ChordShape> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const shape = coerceShape(v);
      if (shape) out[k] = shape;
    }
    return out;
  } catch {
    return {};
  }
}

/** Разбирает ручной ввод: «x32010», «x 3 2 0 1 0», «-1 3 2 0 1 0». Иначе null. */
export function parseFrets(input: string): ChordFrets | null {
  const s = input.trim();
  if (!s) return null;
  let parts: string[];
  if (/[\s,]/.test(s) || s.includes('-')) {
    parts = s.split(/[\s,]+/).filter(Boolean);
  } else {
    parts = s.split(''); // компактный вид «x32010» (лады 0..9)
  }
  if (parts.length !== 6) return null;
  const frets = parts.map((p) => {
    if (p === 'x' || p === 'X' || p === '-' || p === '-1') return -1;
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 24 ? n : NaN;
  });
  return frets.some((n) => Number.isNaN(n)) ? null : frets;
}

/**
 * Квинты (power chords) в нотации «лад + В/Н»:
 *   NВ — верхняя квинта, корень на 6-й струне: [N, N+2, N+2, x, x, x];
 *   NН — нижняя квинта, та же форма на струну тоньше (5/4/3): [x, N, N+2, N+2, x, x].
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
 * Аппликатура по имени аккорда. customDefs (с песни) имеют приоритет.
 * Возвращает null, если формы нет (нужно задать вручную).
 */
export function getChordShape(
  name: string,
  customDefs?: Record<string, ChordShape>,
): ChordShape | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (customDefs && customDefs[trimmed]) return customDefs[trimmed];

  const base = trimmed.split('/')[0]; // бас в slash-аккорде для диаграммы игнорируем
  if (customDefs && customDefs[base]) return customDefs[base];

  const power = parsePowerFifth(base);
  if (power) return { frets: power };

  if (OPEN_SHAPES[base]) return { frets: OPEN_SHAPES[base] };

  const m = /^([A-G][#b]*)(.*)$/.exec(base);
  if (!m) return null;
  const rootPc = noteToPc(m[1]);
  if (rootPc === null) return null;
  const gen = E_SHAPES[m[2]];
  if (!gen) return null;

  const f = mod12(rootPc - 4); // лад барре на 6-й струне
  return { frets: gen(f) };
}
