/**
 * Инструменты: строй, число струн и таблицы аппликатур.
 *
 * Песня привязана к одному инструменту (`Song.instrument`), и от него зависит
 * всё, что рисует гриф: сколько струн, какие открытые формы, как считается
 * подвижная (барре) форма. Сам текст ChordPro инструмент-независим — поэтому
 * один и тот же разбор можно было бы показать и на гитаре, и на укулеле.
 *
 * Форма — массив ладов по струнам, от САМОЙ НИЖНЕЙ по номеру (у гитары 6-я,
 * толстая; у укулеле 4-я, G) к 1-й. Это порядок, в котором аккорд рисуют на
 * схемах слева направо. Значения: -1 = не звучит (×), 0 = открытая, N = лад.
 */

import { mod12 } from './pitch';
import { withPluralRu } from '../plural';

export type ChordFrets = number[];

/** Баррэ: горизонтальная палка на ладу `fret` через струны from..to. */
export interface Barre {
  fret: number; // абсолютный лад (>= 1)
  from: number; // индекс струны (0 = самая нижняя по номеру), from < to
  to: number;
}

/**
 * Аппликатура: лады по струнам + опциональные баррэ (для рендера палки).
 * Кастомные формы на песне могут задавать баррэ; сгенерированные/встроенные —
 * получают его автоматически (см. `deriveBarres`).
 */
export interface ChordShape {
  frets: ChordFrets;
  barres?: Barre[];
}

export type InstrumentId = 'guitar' | 'ukulele';

export interface Instrument {
  id: InstrumentId;
  /** Название в интерфейсе. */
  name: string;
  /** «аккорды для гитары» / «аккорды для укулеле» — для подписей и мета. */
  forName: string;
  /** «на гитаре» / «на укулеле» — для заголовков страниц. */
  onName: string;
  strings: number;
  /** Высоты открытых струн (pitch class), в том же порядке, что и лады. */
  openPcs: number[];
  /** Подписи струн под грифом в редакторе. */
  labels: string[];
  /** Ходовые открытые аккорды. */
  openShapes: Record<string, ChordFrets>;
  /**
   * Подвижные формы: функция от сдвига в ладах относительно формы с корнем
   * `movableRootPc`. Так любой major/m/7/m7/maj7 получает аппликатуру, даже
   * если его нет в таблице открытых.
   */
  movableShapes: Record<string, (shift: number) => ChordFrets>;
  /** Высота корня, от которой считается сдвиг подвижных форм. */
  movableRootPc: number;
  /**
   * Поддержка записи квинт «лад + В/Н» (гитарная нотация из русских табов).
   * На укулеле такие квинты не играют — там это выключено.
   */
  powerChords: boolean;
}

// ─── Гитара ────────────────────────────────────────────────────────────────
// Строй EADGBe, от 6-й струны к 1-й.

const GUITAR_OPEN: Record<string, ChordFrets> = {
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

// Барре-формы E-типа: корень на 6-й струне (открытая E, pc 4).
const GUITAR_MOVABLE: Record<string, (f: number) => ChordFrets> = {
  '': (f) => [f, f + 2, f + 2, f + 1, f, f],
  m: (f) => [f, f + 2, f + 2, f, f, f],
  '7': (f) => [f, f + 2, f, f + 1, f, f],
  m7: (f) => [f, f + 2, f, f, f, f],
  maj7: (f) => [f, f + 2, f + 1, f + 1, f, f],
};

// ─── Укулеле ───────────────────────────────────────────────────────────────
// Строй GCEA (сопрано/концерт/тенор), от 4-й струны к 1-й. Четвёртая струна
// у стандартного строя «возвратная» (звучит выше третьей), но на аппликатуру
// это не влияет — она задаётся высотой в пределах октавы.

const UKULELE_OPEN: Record<string, ChordFrets> = {
  C: [0, 0, 0, 3],
  Cm: [0, 3, 3, 3],
  C7: [0, 0, 0, 1],
  Cm7: [3, 3, 3, 3],
  Cmaj7: [0, 0, 0, 2],
  D: [2, 2, 2, 0],
  Dm: [2, 2, 1, 0],
  D7: [2, 2, 2, 3],
  Dm7: [2, 2, 1, 3],
  Dmaj7: [2, 2, 2, 4],
  E: [4, 4, 4, 2],
  Em: [0, 4, 3, 2],
  E7: [1, 2, 0, 2],
  Em7: [0, 2, 0, 2],
  F: [2, 0, 1, 0],
  Fm: [1, 0, 1, 3],
  F7: [2, 3, 1, 3],
  Fm7: [1, 3, 1, 3],
  Fmaj7: [2, 4, 1, 3],
  G: [0, 2, 3, 2],
  Gm: [0, 2, 3, 1],
  G7: [0, 2, 1, 2],
  Gm7: [0, 2, 1, 1],
  Gmaj7: [0, 2, 2, 2],
  A: [2, 1, 0, 0],
  Am: [2, 0, 0, 0],
  A7: [0, 1, 0, 0],
  Am7: [0, 0, 0, 0],
  Amaj7: [1, 1, 0, 0],
  B: [4, 3, 2, 2],
  Bm: [4, 2, 2, 2],
  B7: [2, 3, 2, 2],
  Bm7: [2, 2, 2, 2],
  Bb: [3, 2, 1, 1],
  Bbm: [3, 1, 1, 1],
};

// Подвижные формы A-типа: корень на 1-й струне (открытая A, pc 9).
// Проверено тестами: сдвиг на n ладов даёт аккорд с корнем pc 9 + n.
const UKULELE_MOVABLE: Record<string, (f: number) => ChordFrets> = {
  '': (f) => [f + 2, f + 1, f, f],
  m: (f) => [f + 2, f, f, f],
  '7': (f) => [f, f + 1, f, f],
  m7: (f) => [f, f, f, f],
  maj7: (f) => [f + 1, f + 1, f, f],
};

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  guitar: {
    id: 'guitar',
    name: 'Гитара',
    forName: 'гитары',
    onName: 'гитаре',
    strings: 6,
    openPcs: [4, 9, 2, 7, 11, 4], // E A D G B e
    labels: ['E', 'A', 'D', 'G', 'B', 'e'],
    openShapes: GUITAR_OPEN,
    movableShapes: GUITAR_MOVABLE,
    movableRootPc: 4,
    powerChords: true,
  },
  ukulele: {
    id: 'ukulele',
    name: 'Укулеле',
    forName: 'укулеле',
    onName: 'укулеле',
    strings: 4,
    openPcs: [7, 0, 4, 9], // G C E A
    labels: ['G', 'C', 'E', 'A'],
    openShapes: UKULELE_OPEN,
    movableShapes: UKULELE_MOVABLE,
    movableRootPc: 9,
    powerChords: false,
  },
};

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[];

export const DEFAULT_INSTRUMENT: InstrumentId = 'guitar';

/** Приводит значение из БД/формы/URL к известному инструменту. */
export function parseInstrumentId(value: string | null | undefined): InstrumentId {
  return value === 'ukulele' ? 'ukulele' : DEFAULT_INSTRUMENT;
}

/** Инструмент по идентификатору; неизвестное значение → гитара. */
export function getInstrument(value: string | null | undefined): Instrument {
  return INSTRUMENTS[parseInstrumentId(value)];
}

/**
 * Адрес каталога инструмента. У гитары это корень сайта — он таким и был до
 * разделения, поэтому все ссылки, canonical и позиции в поиске сохраняются.
 */
export function catalogPath(id: InstrumentId): string {
  return id === 'guitar' ? '/' : `/${id}`;
}

/** «6 струн» / «4 струны» / «1 струна» — с русским склонением. */
export function stringsLabel(strings: number): string {
  return withPluralRu(strings, 'струна', 'струны', 'струн');
}

/**
 * Высоты, которые реально звучат в аппликатуре (pitch class без повторов).
 * Нужна тестам, проверяющим что форма соответствует названию аккорда, и
 * пригодится подбору аппликатур.
 */
export function soundingPcs(instrument: Instrument, frets: ChordFrets): number[] {
  const out = new Set<number>();
  frets.forEach((f, i) => {
    if (f < 0 || i >= instrument.openPcs.length) return;
    out.add(mod12(instrument.openPcs[i] + f));
  });
  return [...out].sort((a, b) => a - b);
}
