/**
 * Подборки разборов — «песни на 4 аккорда», «песни на квинтах».
 *
 * ── Зачем ───────────────────────────────────────────────────────────────────
 *
 * «Песни на 4 аккорда», «простые песни на гитаре», «лёгкие песни для
 * начинающих» — самостоятельный и большой класс запросов, к которому у сайта не
 * было ни одной страницы. При том что материал под него уже лежит готовым:
 * 58 разборов из 69 играются на четырёх аккордах и меньше, 40 собраны целиком
 * на квинтах. Считать ничего не надо — надо перестать это прятать.
 *
 * ── Почему подборок мало и они заданы руками ────────────────────────────────
 *
 * Соблазн сгенерировать страницу под каждое сочетание («на 5 аккордах», «без
 * баррэ», «на квинтах для укулеле») велик, и это ровно то, что превращает
 * раздел в свалку дорвеев. Подборка заводится, только если ей есть что
 * показать: «без баррэ» в этом каталоге — три песни, и такой страницы здесь
 * нет.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { SONGS_TAG, cachedByKey } from './cache';
import { cardSelect, type SongCard } from './engagement';

export interface Collection {
  slug: string;
  /** Заголовок страницы и h1. */
  title: string;
  /** Короткое пояснение под заголовком. */
  intro: string;
  /** Описание для выдачи; число разборов подставляется вызывающим кодом. */
  description: (count: number) => string;
  /** Условие отбора — на SQL, потому что длину массива Prisma в `where` не умеет. */
  where: Prisma.Sql;
}

/** Все аккорды разбора — квинты. Пустые разборы не считаются. */
const ONLY_POWER = Prisma.sql`
  array_length("chords", 1) >= 2
  AND NOT EXISTS (
    SELECT 1 FROM unnest("chords") c WHERE c !~ '^[A-G][#b]?5$'
  )
`;

/** Не больше N разных аккордов. */
const atMost = (n: number) => Prisma.sql`
  array_length("chords", 1) BETWEEN 1 AND ${n}
`;

export const COLLECTIONS: Collection[] = [
  {
    slug: 'na-4-akkorda',
    title: 'Песни на 4 аккорда',
    intro:
      'Разборы, которые целиком играются четырьмя аккордами или меньше. Выучил четыре формы — ' +
      'и песня собирается от начала до конца, без переходов, которые надо разучивать отдельно.',
    description: (n) =>
      `${n} разборов, которые играются четырьмя аккордами и меньше: текст с аккордами над ` +
      'словами, схемы аппликатур и транспонирование под голос.',
    where: atMost(4),
  },
  {
    slug: 'na-3-akkorda',
    title: 'Песни на 3 аккорда',
    intro:
      'Самое начало: три формы, между которыми и происходит вся песня. Хороший список для ' +
      'первых недель, когда переход между аккордами занимает больше времени, чем сама строчка.',
    description: (n) =>
      `${n} разборов на трёх аккордах и меньше — для тех, кто только учится переставлять ` +
      'пальцы. Схемы аппликатур и транспонирование прилагаются.',
    where: atMost(3),
  },
  {
    slug: 'na-kvintah',
    title: 'Песни на квинтах',
    intro:
      'Разборы, целиком собранные на квинтах — они же пауэр-аккорды. Терции в них нет, поэтому ' +
      'нет ни мажора, ни минора, а форма одна и та же и просто ездит по грифу. С них проще ' +
      'всего начать играть тяжёлое, и на них держится почти весь русский андеграунд.',
    description: (n) =>
      `${n} разборов целиком на квинтах: одна форма на весь гриф, схемы аппликатур и ` +
      'привычная запись ладом и струной.',
    where: ONLY_POWER,
  },
];

export function findCollection(slug: string): Collection | null {
  return COLLECTIONS.find((c) => c.slug === slug.trim().toLowerCase()) ?? null;
}

/**
 * Разборы подборки. Отбор — сырым SQL (длина массива), карточки — обычной
 * выборкой по найденным id: только так в строку попадает число лайков, которое
 * `cardSelect` собирает связью.
 */
export const listCollectionSongs = (collection: Collection, limit = 120) =>
  cachedByKey(['collection', collection.slug, String(limit)], [SONGS_TAG], async () => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Song"
      WHERE "visibility" = 'public' AND ${collection.where}
      ORDER BY "viewCount" DESC, "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [] as SongCard[];

    const found = await prisma.song.findMany({
      where: { id: { in: ids } },
      select: cardSelect,
    });
    // `findMany` порядок из `in` не сохраняет — восстанавливаем по списку id.
    const byId = new Map(found.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)).filter((s): s is SongCard => !!s);
  });

/** Сколько разборов в подборке — для указателя и описаний. */
export const countCollection = (collection: Collection) =>
  cachedByKey(['collection-count', collection.slug], [SONGS_TAG], async () => {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "Song"
      WHERE "visibility" = 'public' AND ${collection.where}
    `;
    return rows[0]?.n ?? 0;
  });
