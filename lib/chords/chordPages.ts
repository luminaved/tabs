/**
 * Справочник аккордов: адреса, инвентарь каталога и выборки для страниц.
 *
 * ── Зачем раздел ────────────────────────────────────────────────────────────
 *
 * Запросы «аккорд F на гитаре», «аппликатура Bm», «как ставить G#m» — отдельный
 * и большой класс, к которому у сайта не было ни одной страницы, хотя все
 * данные для них уже лежат: формы считает `getChordShape`, а какие аккорды
 * вообще встречаются — денормализованная колонка `Song.chords`.
 *
 * Отличие от готовых справочников в выдаче (pereborom, akkordam и прочие) —
 * не в тексте, а в том, чего у них нет: страница показывает форму СРАЗУ для
 * гитары и укулеле и ведёт на живые разборы сайта с этим аккордом. Плюс
 * квинты: их подписывают ещё и записью «лад + В/Н» из русских табов, а её в
 * поиске не объясняет никто.
 *
 * ── Почему страницы только для аккордов каталога ────────────────────────────
 *
 * Форму можно посчитать для любого имени, и соблазн завести страницу под каждое
 * велик. Но страница про аккорд, которого нет ни в одном разборе, — это дорвей:
 * показать на ней нечего, кроме картинки, которую рисует и калькулятор. Поэтому
 * список берётся из каталога, и раздел растёт вместе с ним.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { SONGS_TAG, cachedByKey } from '../cache';
import { parseChord } from './chord';
import { getChordShape, powerFifthLabelForShape, type ChordShape } from './diagrams';
import { INSTRUMENT_IDS, getInstrument, type InstrumentId } from './instruments';
import { cardSelect, type SongCard } from '../engagement';

/**
 * Имя аккорда в часть адреса.
 *
 * Диез в адрес голым не поставить: `#` начинает якорь, и «/chords/A#5» браузер
 * обрежет до «/chords/A». Проценты («A%235») читаются человеком как мусор и
 * плохо переживают копирование. Поэтому знак пишется словом.
 */
export function chordSlug(name: string): string {
  // Разбираем именно корень: знак альтерации бывает ТОЛЬКО у него, а в
  // суффиксе качества буква «b» — обычная («b5», «b9»). Простая замена всех «b»
  // на «-flat» ломала даже голое «B», превращая его в «-flat».
  const m = /^([A-G])([#b]?)(.*)$/.exec(name.trim());
  if (!m) return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const [, letter, accidental, quality] = m;
  const sign = accidental === '#' ? '-sharp' : accidental === 'b' ? '-flat' : '';
  const tail = quality.toLowerCase().replace(/[^a-z0-9]/g, '');
  const root = letter.toLowerCase();
  // Без знака подпись слитная («am», «fmaj7»); со знаком нужен разделитель,
  // иначе «a-sharp» + «m» слиплось бы в «a-sharpm».
  return sign ? `${root}${sign}${tail ? `-${tail}` : ''}` : `${root}${tail}`;
}

/**
 * Аккорд по части адреса — ТОЛЬКО из числа известных.
 *
 * Разбирать подпись обратно не пытаемся: «-sharp» и «-flat» неоднозначны с
 * суффиксами качества, а ошибиться здесь значит нарисовать не тот аккорд.
 * Сверка со списком заодно гарантирует, что страницы заводятся лишь для
 * аккордов, которые в каталоге правда есть.
 */
export function chordFromSlug(slug: string, known: readonly string[]): string | null {
  const target = slug.trim().toLowerCase();
  return known.find((name) => chordSlug(name) === target) ?? null;
}

/** Аккорд каталога — уже со сведённой энгармоникой (см. `listCatalogChords`). */
export interface ChordEntry {
  /** Каноническое написание: то, которым аккорд записан чаще. */
  name: string;
  slug: string;
  /** Прочие написания той же высоты из каталога: «Bb5» при каноническом «A#5». */
  aliases: string[];
  /** Сколько разборов используют аккорд во всех написаниях сразу. */
  count: number;
  /** Квинта — у них своя подача и свои запросы. */
  power: boolean;
}

/** Разбит ли аккорд на «квинту» по имени: «A5», «F#5». */
export function isPowerChordName(name: string): boolean {
  return /^[A-G][#b]?5$/.test(name.trim());
}

/**
 * Аккорды, встречающиеся в публичных разборах, по убыванию частоты.
 *
 * Считается в БД через `unnest` по денормализованной колонке: собирать то же
 * самое из выбранных строк значило бы тащить наружу весь каталог ради
 * пересчёта, который Postgres делает одним проходом.
 */
export const listCatalogChords = (instrument?: InstrumentId) =>
  cachedByKey(['chord-inventory', instrument ?? 'all'], [SONGS_TAG], async () => {
    const rows = await prisma.$queryRaw<{ name: string; count: number }[]>`
      SELECT c AS "name", count(*)::int AS "count"
      FROM "Song", unnest("chords") c
      WHERE "visibility" = 'public'
        ${instrument ? Prisma.sql`AND "instrument" = ${instrument}` : Prisma.empty}
      GROUP BY c
      ORDER BY count(*) DESC, c ASC
    `;
    /*
     * Энгармоника сводится в ОДНУ запись, и это не косметика.
     *
     * «A#5» и «Bb5» — один и тот же аккорд с одной и той же формой, но в
     * каталоге записаны обоими способами. Порознь они дали бы две страницы с
     * одинаковой картинкой и разорванным пополам списком песен — то есть ровно
     * тот тонкий дубль, ради избавления от которого у разборов и исполнителей
     * стоит 308 на канонический адрес.
     *
     * Каноническим считаем написание, которым аккорд записан чаще: так адрес
     * совпадает с тем, как эту песню ищут. При равенстве побеждает первое по
     * порядку (он уже отсортирован по частоте, затем по имени) — лишь бы выбор
     * был устойчивым от сборки к сборке.
     */
    const clean = rows.filter((r) =>
      // Мусор из чужих табов («D#m*», пустые строки) в справочник не пускаем:
      // страницы под него не нужны, а форму для него всё равно не построить.
      /^[A-G][#b]?[A-Za-z0-9+()/]*$/.test(r.name),
    );

    const groups = new Map<string, ChordEntry>();
    for (const row of clean) {
      const chord = parseChord(row.name);
      if (!chord) continue;
      const key = `${chord.rootPc}|${chord.quality}|${chord.bassPc ?? ''}`;
      const found = groups.get(key);
      if (!found) {
        groups.set(key, {
          name: row.name,
          slug: chordSlug(row.name),
          aliases: [],
          count: row.count,
          power: isPowerChordName(row.name),
        });
        continue;
      }
      found.count += row.count;
      found.aliases.push(row.name);
    }

    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

/**
 * Разборы каталога, где встречается аккорд, — во ВСЕХ его написаниях.
 *
 * Список имён, а не одно имя: страница «A#5» обязана показывать и песни,
 * записанные через «Bb5», иначе сведение энгармоники получилось бы только в
 * адресе, а содержимое осталось бы разорванным.
 */
export const listSongsWithChord = (names: readonly string[], limit = 24) =>
  cachedByKey(['chord-songs', names.join('|'), String(limit)], [SONGS_TAG], async () => {
    const rows = await prisma.song.findMany({
      where: { visibility: 'public', chords: { hasSome: [...names] } },
      orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: cardSelect,
    });
    return rows;
  }) as Promise<SongCard[]>;

/** Форма аккорда на каждом инструменте — либо null, если её нет. */
export interface ChordShapeOnInstrument {
  instrument: InstrumentId;
  shape: ChordShape | null;
  /** Подпись «лад + В/Н» — только для гитарных квинт (см. powerFifthLabelForShape). */
  fretLabel: string | null;
}

export function shapesForChord(name: string): ChordShapeOnInstrument[] {
  return INSTRUMENT_IDS.map((id) => {
    const inst = getInstrument(id);
    const shape = getChordShape(name, inst);
    return {
      instrument: id,
      shape,
      fretLabel: shape && inst.fifthShorthand ? powerFifthLabelForShape(shape.frets) : null,
    };
  });
}
