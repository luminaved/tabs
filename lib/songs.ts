import { cache } from 'react';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { INSTRUMENT_IDS, parseInstrumentId, type InstrumentId } from './chords/instruments';
// Строка списка карточек определена в engagement.ts — здесь она же
// переэкспортируется, чтобы вызывающему коду не приходилось знать, в каком из
// двух модулей лежит нужный ему список.
import { cardSelect, type SongListPage } from './engagement';
export type { SongListPage } from './engagement';
import { SONGS_PAGE_SIZE, pageSkip, pageTake, parsePage, splitPage } from './paging';
import { buildSearchText, searchQueryForLike } from './chordpro/searchText';
import { withChordChips } from './chordpro/usedChords';

export type SongVisibility = 'private' | 'unlisted' | 'public';

export interface SongInput {
  title: string;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  body: string;
  note?: string | null;
  /**
   * Обложка. Три состояния, и они РАЗНЫЕ: data URL — поставить новую,
   * `null` — убрать, `undefined` — не трогать (см. `coverFields`).
   */
  coverUrl?: string | null;
  chordDefs?: string | null;
  visibility: SongVisibility;
  instrument: InstrumentId;
}

function normalize(input: SongInput) {
  const title = input.title.trim();
  const artist = input.artist?.trim() || null;
  return {
    title,
    artist,
    searchText: buildSearchText({ title, artist, body: input.body }),
    key: input.key?.trim() || null,
    tempo: input.tempo ?? null,
    body: input.body,
    note: input.note?.trim() || null,
    chordDefs: input.chordDefs?.trim() || null,
    visibility: input.visibility,
    instrument: input.instrument,
  };
}

/**
 * Поля обложки — либо ПУСТО, если картинку не трогаем.
 *
 * Именно пустота и позволила убрать base64 из формы: пока «не прислали» значило
 * «убрать», редактор был обязан возвращать всю картинку при каждом сохранении.
 * Теперь `undefined` не попадает в `data`, и Prisma оставляет колонки как есть.
 *
 * `hasCover` всегда пишется вместе с `coverUrl` — флаг обязан оставаться в
 * согласии с картинкой, иначе списки покажут миниатюру, которой нет (или
 * наоборот спрячут существующую).
 */
function coverFields(coverUrl: string | null | undefined) {
  if (coverUrl === undefined) return {};
  const value = coverUrl?.trim() || null;
  return { coverUrl: value, hasCover: !!value };
}

/**
 * Условие текстового поиска — считается в БД.
 *
 * Ищем по денормализованной колонке `searchText` (название + исполнитель +
 * слова песни без разметки), поэтому находится и строчка из середины песни —
 * а люди помнят именно строчку, а не название. Колонка уже в нижнем регистре,
 * так что запрос приводим к нему же и обходимся без `mode: 'insensitive'`.
 *
 * Раньше поиск фильтровал уже выбранную страницу на стороне JS: выборка
 * сначала обрезалась потолком, и песня за его пределами не находилась вовсе.
 * Теперь фильтр уходит в `where` — до `take`, поэтому ищется вся база.
 *
 * Маски LIKE в запросе экранируются (см. `searchQueryForLike`).
 */
function searchFilter(query?: string): Prisma.SongWhereInput {
  const q = searchQueryForLike(query);
  if (!q) return {};
  return { searchText: { contains: q } };
}

/**
 * «Мои песни» — только собственные разборы пользователя (любой видимости).
 */
export async function listSongs(
  viewerId: string,
  filters: { query?: string; instrument?: InstrumentId; page?: number },
): Promise<SongListPage> {
  const rows = await prisma.song.findMany({
    where: {
      userId: viewerId,
      ...(filters.instrument ? { instrument: filters.instrument } : {}),
      ...searchFilter(filters.query),
    },
    // id в хвосте сортировки — иначе строки с равным updatedAt разъезжаются
    // между страницами и дублируются при подгрузке.
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    skip: pageSkip(filters.page ?? 0),
    take: pageTake(),
    select: cardSelect,
  });
  const { page, hasMore } = splitPage(rows);
  return { songs: page.map(withChordChips), hasMore };
}

/** Сколько своих разборов у пользователя по каждому инструменту. */
export async function countOwnByInstrument(
  viewerId: string,
): Promise<Record<InstrumentId, number>> {
  const rows = await prisma.song.groupBy({
    by: ['instrument'],
    where: { userId: viewerId },
    _count: { _all: true },
  });
  const out: Record<InstrumentId, number> = { guitar: 0, ukulele: 0 };
  for (const r of rows) {
    const id = r.instrument === 'ukulele' ? 'ukulele' : 'guitar';
    out[id] += r._count._all;
  }
  return out;
}

/** Размер порции — общий для всех списков песен, см. [paging.ts](./paging.ts). */
export const CATALOG_PAGE_SIZE = SONGS_PAGE_SIZE;

/** Порядок в каталоге: новые / популярные (просмотры) / любимые (лайки). */
export type SongSort = 'new' | 'views' | 'likes';

const SORT_ORDER: Record<SongSort, Prisma.SongOrderByWithRelationInput[]> = {
  new: [{ createdAt: 'desc' }],
  views: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
  likes: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
};

/** Приводит значение из query-параметра к допустимой сортировке. */
export function parseSort(value: string | undefined): SongSort {
  return value === 'views' || value === 'likes' ? value : 'new';
}

// Поля строки каталога. `body` нужен, чтобы посчитать чипы аккордов, но наружу
// не отдаётся — см. `withChordChips`. coverUrl (тяжёлый base64) не выбираем:
// картинку отдаёт отдельный маршрут /covers/[id].
const catalogSelect = {
  id: true,
  title: true,
  artist: true,
  key: true,
  body: true,
  hasCover: true,
  instrument: true,
  verified: true,
  updatedAt: true,
  viewCount: true,
  user: { select: { id: true, name: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.SongSelect;

type CatalogRecord = Prisma.SongGetPayload<{ select: typeof catalogSelect }>;

/** Строка каталога, как она уходит в разметку и на клиент: без текста песни. */
export type CatalogSong = Omit<CatalogRecord, 'body'> & { chords: string[] };

export interface CatalogPage {
  songs: CatalogSong[];
  /** Есть ли следующая порция — знаем без COUNT, взяв на одну строку больше. */
  hasMore: boolean;
  /** Точных совпадений не нашлось — показаны похожие (вероятно, опечатка). */
  fuzzy?: boolean;
}

/**
 * Порог близости для подбора при опечатке (word_similarity из pg_trgm).
 * Замерено на живых примерах: «влеченте» → «влечение» даёт 0.667,
 * «вличение» → 0.500, «маршрудка» → «маршрутка» 0.600. Ниже 0.45 в выдачу
 * начинает попадать случайное.
 *
 * Обычная `similarity` здесь не годится: она нормируется на длину всей строки,
 * и короткий запрос против текста песни целиком даёт ~0.04. `word_similarity`
 * сравнивает запрос с самым похожим участком текста — то, что нужно.
 */
const FUZZY_THRESHOLD = 0.45;

/** Короче этого подбор не запускаем — см. комментарий у места вызова. */
const FUZZY_MIN_QUERY = 3;

/**
 * Похожие разборы при опечатке в запросе. Возвращает id по убыванию близости.
 * Требует расширения pg_trgm (см. scripts/setup-search.mjs).
 */
async function fuzzyMatchIds(
  query: string,
  instrument: InstrumentId | undefined,
  verified: boolean,
  limit: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Song"
    WHERE "visibility" = 'public'
      ${instrument ? Prisma.sql`AND "instrument" = ${instrument}` : Prisma.empty}
      ${verified ? Prisma.sql`AND "verified" = true` : Prisma.empty}
      AND word_similarity(${query}, "searchText") >= ${FUZZY_THRESHOLD}
    ORDER BY word_similarity(${query}, "searchText") DESC, "viewCount" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

/**
 * Публичный каталог: только песни с visibility "public" (со всех аккаунтов).
 * Приватные и «по ссылке» сюда не попадают.
 *
 * Выдача постраничная: `page` (с нуля) × `CATALOG_PAGE_SIZE`. Поиск считается
 * в БД (см. `searchFilter`), поэтому находится вся база, а не первая страница.
 */
export async function listPublicSongs(filters: {
  query?: string;
  sort?: SongSort;
  page?: number;
  /** Каталог одного инструмента; без него — разборы для всех инструментов. */
  instrument?: InstrumentId;
  /** Только подтверждённые модератором разборы. */
  verified?: boolean;
}): Promise<CatalogPage> {
  const page = parsePage(filters.page ?? 0);
  const where: Prisma.SongWhereInput = {
    visibility: 'public',
    ...(filters.instrument ? { instrument: filters.instrument } : {}),
    ...(filters.verified ? { verified: true } : {}),
    ...searchFilter(filters.query),
  };

  const rows = await prisma.song.findMany({
    where,
    // id в хвосте сортировки: без него строки с одинаковым ключом могут
    // разъезжаться между страницами и дублироваться при подгрузке.
    orderBy: [...SORT_ORDER[filters.sort ?? 'new'], { id: 'desc' }],
    skip: pageSkip(page),
    take: pageTake(),
    select: catalogSelect,
  });

  if (rows.length > 0) {
    const { page: rowsPage, hasMore } = splitPage(rows);
    return { songs: rowsPage.map(withChordChips), hasMore };
  }

  // Точных совпадений нет — пробуем понять, что человек имел в виду.
  // Только для первой страницы: «показаны похожие» — спасательный проход,
  // листать его незачем.
  // Короткие запросы в подбор не пускаем: у односимвольного близость к любому
  // слову с этой буквой равна 1.0, и «похожим» оказывается весь каталог.
  const q = filters.query?.trim().toLowerCase();
  if (!q || q.length < FUZZY_MIN_QUERY || page > 0) return { songs: [], hasMore: false };

  // Подбор уважает тот же отбор: иначе при включённом «только подтверждённые»
  // опечатка возвращала бы неподтверждённые разборы.
  const ids = await fuzzyMatchIds(q, filters.instrument, !!filters.verified, CATALOG_PAGE_SIZE);
  if (ids.length === 0) return { songs: [], hasMore: false };

  const found = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: catalogSelect,
  });
  // findMany не сохраняет порядок из `in` — восстанавливаем его по близости.
  const byId = new Map(found.map((s) => [s.id, s]));
  const songs = ids
    .map((id) => byId.get(id))
    .filter((s): s is CatalogRecord => !!s)
    .map(withChordChips);

  return { songs, hasMore: false, fuzzy: true };
}

/**
 * Публичные разборы одного исполнителя. Исполнитель — свободное текстовое поле
 * на песне (отдельной модели нет), поэтому сравниваем без учёта регистра.
 */
export async function listSongsByArtist(
  artist: string,
  filters: { page?: number } = {},
): Promise<SongListPage> {
  const name = artist.trim();
  if (!name) return { songs: [], hasMore: false };
  const rows = await prisma.song.findMany({
    where: { visibility: 'public', artist: { equals: name, mode: 'insensitive' } },
    orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    skip: pageSkip(filters.page ?? 0),
    take: pageTake(),
    select: cardSelect,
  });
  const { page, hasMore } = splitPage(rows);
  return { songs: page.map(withChordChips), hasMore };
}

/**
 * Сводка по исполнителю: сколько у него публичных разборов и на какие
 * инструменты. Считается отдельным запросом, а НЕ по загруженной странице:
 * заголовок и мета собираются по всем разборам сразу, иначе после разбивки на
 * страницы «13 разборов» превратилось бы в «24», а укулеле, оказавшись на
 * второй странице, пропало бы из заголовка.
 *
 * cache(): страница и generateMetadata спрашивают одно и то же.
 */
export const getArtistSummary = cache(async function getArtistSummary(artist: string) {
  const name = artist.trim();
  const empty = { total: 0, instruments: [] as InstrumentId[] };
  if (!name) return empty;

  const rows = await prisma.song.groupBy({
    by: ['instrument'],
    where: { visibility: 'public', artist: { equals: name, mode: 'insensitive' } },
    _count: { _all: true },
  });

  const counts: Record<InstrumentId, number> = { guitar: 0, ukulele: 0 };
  for (const r of rows) counts[parseInstrumentId(r.instrument)] += r._count._all;

  return {
    total: counts.guitar + counts.ukulele,
    instruments: INSTRUMENT_IDS.filter((id) => counts[id] > 0),
  };
});

/** Точное написание имени исполнителя, как оно хранится (для заголовка). */
export const findArtistName = cache(async function findArtistName(artist: string) {
  const name = artist.trim();
  if (!name) return null;
  const row = await prisma.song.findFirst({
    where: { visibility: 'public', artist: { equals: name, mode: 'insensitive' } },
    select: { artist: true },
  });
  return row?.artist ?? null;
});

/**
 * Все исполнители с публичными разборами — для карты сайта.
 *
 * groupBy, а не findMany + distinct: `distinct` у Prisma схлопывает строки УЖЕ
 * НА КЛИЕНТЕ — в SQL никакого DISTINCT не уходит, и вдобавок в выборку
 * подставляется `id`, чтобы было по чему различать. То есть из базы приезжала
 * строка на каждый публичный разбор, а наружу отдавался список уникальных имён.
 * На двух десятках песен разница незаметна, на нескольких тысячах — это тысячи
 * строк по сети ради пары сотен имён, причём на построении карты сайта.
 * groupBy же компилируется в настоящий GROUP BY и считается в Postgres.
 */
export async function listPublicArtists(): Promise<string[]> {
  const rows = await prisma.song.groupBy({
    by: ['artist'],
    where: { visibility: 'public', artist: { not: null } },
  });
  return rows.map((r) => r.artist).filter((a): a is string => !!a?.trim());
}

/**
 * Просмотр с учётом видимости: private — только владельцу.
 * coverUrl (тяжёлый base64) не выбираем — картинку отдаёт /covers/[id].
 *
 * Обёрнуто в cache(): страница и generateMetadata запрашивают одну и ту же
 * песню, без дедупликации это лишний поход в БД на каждую загрузку.
 */
export const getSongForViewer = cache(async function getSongForViewer(
  id: string,
  viewerId?: string,
) {
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      tempo: true,
      body: true,
      note: true,
      chordDefs: true,
      hasCover: true,
      instrument: true,
      verified: true,
      visibility: true,
      viewCount: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!song) return null;
  if (song.visibility === 'private' && song.userId !== viewerId) return null;
  return song;
});

/**
 * Строго своя песня — для редактирования.
 *
 * `coverUrl` НЕ выбираем: раньше здесь стоял `findUnique` без `select`, то есть
 * весь base64 обложки ехал из базы, вшивался в HTML страницы редактирования и
 * возвращался в POST при сохранении. Редактору хватает `hasCover` и
 * `updatedAt` — из них собирается ссылка на /covers/[id] (см. coverSrc), а сама
 * картинка приходит в браузер отдельным кэшируемым запросом, как везде.
 */
export async function getOwnedSong(id: string, userId: string) {
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      tempo: true,
      body: true,
      note: true,
      chordDefs: true,
      hasCover: true,
      instrument: true,
      visibility: true,
      updatedAt: true,
      userId: true,
    },
  });
  if (!song || song.userId !== userId) return null;
  return song;
}

export function createSong(userId: string, input: SongInput) {
  // У новой песни сохранять нечего, поэтому «не трогать» здесь читается как
  // «обложки нет».
  return prisma.song.create({
    data: { ...normalize(input), ...coverFields(input.coverUrl ?? null), userId },
  });
}

export async function updateSong(id: string, userId: string, input: SongInput) {
  const existing = await prisma.song.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return null;
  return prisma.song.update({
    where: { id },
    data: { ...normalize(input), ...coverFields(input.coverUrl) },
  });
}

export async function deleteSong(id: string, userId: string) {
  const existing = await prisma.song.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return false;
  await prisma.song.delete({ where: { id } });
  return true;
}
