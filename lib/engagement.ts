import { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { InstrumentId } from './chords/instruments';
import { searchQueryForLike } from './chordpro/searchText';
import { withChordChips } from './chordpro/usedChords';
import { pageSkip, pageTake, splitPage } from './paging';

// Поля песни для строки списка (каталог/кабинет).
// Внимание: coverUrl (тяжёлый base64) здесь НЕ выбирается — списки берут только
// флаг hasCover, а картинка приходит отдельным кэшируемым запросом /covers/[id].
// `body` нужен только чтобы посчитать чипы аккордов, наружу уходит уже готовый
// список (см. `withChordChips`).
export const cardSelect = {
  id: true,
  title: true,
  artist: true,
  key: true,
  hasCover: true,
  instrument: true,
  verified: true,
  // Нужна подписи в своей библиотеке («приватная» / «по ссылке»). Строка
  // короткая, поэтому проще возить её везде, чем заводить второй набор полей.
  visibility: true,
  updatedAt: true,
  body: true,
  viewCount: true,
  _count: { select: { likes: true } },
} satisfies Prisma.SongSelect;

type SongCardRecord = Prisma.SongGetPayload<{ select: typeof cardSelect }>;

/** Строка списка, как её получает разметка: со списком аккордов вместо текста. */
export type SongCard = Omit<SongCardRecord, 'body'> & { chords: string[] };

/** Порция списка карточек: сама страница и есть ли продолжение. */
export interface SongListPage {
  songs: SongCard[];
  hasMore: boolean;
}

// Только видимые песни: чужие приватные не показываем даже если лайкнуты.
const visibleToUser = (userId: string): Prisma.SongWhereInput => ({
  OR: [{ visibility: { not: 'private' } }, { userId }],
});

/** Избранные песни пользователя (свежие сверху). */
export async function listFavoriteSongs(userId: string): Promise<SongCard[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId, song: visibleToUser(userId) },
    orderBy: { createdAt: 'desc' },
    select: { song: { select: cardSelect } },
  });
  return rows.map((r) => withChordChips(r.song));
}

/** Лайкнутые песни пользователя. */
export async function listLikedSongs(userId: string): Promise<SongCard[]> {
  const rows = await prisma.like.findMany({
    where: { userId, song: visibleToUser(userId) },
    orderBy: { createdAt: 'desc' },
    select: { song: { select: cardSelect } },
  });
  return rows.map((r) => withChordChips(r.song));
}

/**
 * Публичные разборы пользователя (для страницы автора).
 * Поиск и фильтр по инструменту считаются в БД, как и в каталоге.
 */
export async function listUserPublicSongs(
  userId: string,
  filters: { instrument?: InstrumentId; query?: string; page?: number } = {},
): Promise<SongListPage> {
  // По той же денормализованной колонке, что и каталог, — чтобы у автора
  // тоже находилась строчка из середины песни (и с тем же экранированием масок).
  const q = searchQueryForLike(filters.query);
  const rows = await prisma.song.findMany({
    where: {
      userId,
      visibility: 'public',
      ...(filters.instrument ? { instrument: filters.instrument } : {}),
      ...(q ? { searchText: { contains: q } } : {}),
    },
    // id в хвосте: без него строки с одинаковым updatedAt могут разъезжаться
    // между страницами и дублироваться при подгрузке.
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    skip: pageSkip(filters.page ?? 0),
    take: pageTake(),
    select: cardSelect,
  });
  const { page, hasMore } = splitPage(rows);
  return { songs: page.map(withChordChips), hasMore };
}

/**
 * Сколько публичных разборов у автора по каждому инструменту.
 * Считается всегда без учёта поиска — вкладки не должны исчезать по мере ввода.
 */
export async function countUserPublicByInstrument(
  userId: string,
): Promise<Record<InstrumentId, number>> {
  const rows = await prisma.song.groupBy({
    by: ['instrument'],
    where: { userId, visibility: 'public' },
    _count: { _all: true },
  });
  const out: Record<InstrumentId, number> = { guitar: 0, ukulele: 0 };
  for (const r of rows) {
    out[r.instrument === 'ukulele' ? 'ukulele' : 'guitar'] += r._count._all;
  }
  return out;
}

/**
 * Счётчики для кабинета: избранное и лайкнутое. Свои разборы считает
 * `countOwnByInstrument` в [songs.ts](./songs.ts) — они показываются по
 * инструментам, отдельный общий счётчик был бы лишним запросом.
 */
export async function getLibraryCounts(userId: string) {
  const [favorites, liked] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.like.count({ where: { userId } }),
  ]);
  return { favorites, liked };
}

/**
 * Можно ли этому пользователю отмечать этот разбор.
 *
 * Идентификатор приходит с клиента, а кнопка есть только на видимой странице —
 * то есть в самом экшене его никто не проверял, и запросом можно было поставить
 * лайк на ЧУЖОЙ приватный разбор. Текст при этом не утекал (списки фильтрует
 * `visibleToUser`), но счётчик копился заранее и всплывал, стоило автору
 * опубликовать разбор, а разница «получилось / ошибка внешнего ключа» работала
 * оракулом существования id.
 */
async function canEngage(userId: string, songId: string): Promise<boolean> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { userId: true, visibility: true },
  });
  if (!song) return false;
  return song.visibility !== 'private' || song.userId === userId;
}

/** Переключить лайк. true/false — новое состояние, null — нет доступа. */
export async function toggleLike(userId: string, songId: string): Promise<boolean | null> {
  if (!(await canEngage(userId, songId))) return null;

  const existing = await prisma.like.findUnique({
    where: { userId_songId: { userId, songId } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.like.create({ data: { userId, songId } });
  return true;
}

/** Переключить избранное. true/false — новое состояние, null — нет доступа. */
export async function toggleFavorite(userId: string, songId: string): Promise<boolean | null> {
  if (!(await canEngage(userId, songId))) return null;

  const existing = await prisma.favorite.findUnique({
    where: { userId_songId: { userId, songId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.favorite.create({ data: { userId, songId } });
  return true;
}

export interface SongEngagement {
  likeCount: number;
  viewCount: number;
  liked: boolean;
  favorited: boolean;
}

/**
 * Кол-во лайков/просмотров + отметки текущего пользователя — ОДНИМ запросом.
 * Отметки берём фильтрованными связями (при БД в другом регионе каждый лишний
 * round-trip — это десятки миллисекунд к загрузке страницы).
 */
export async function getSongEngagement(
  songId: string,
  userId?: string,
): Promise<SongEngagement> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      viewCount: true,
      _count: { select: { likes: true } },
      ...(userId
        ? {
            likes: { where: { userId }, select: { id: true }, take: 1 },
            favorites: { where: { userId }, select: { id: true }, take: 1 },
          }
        : {}),
    },
  });

  if (!song) return { likeCount: 0, viewCount: 0, liked: false, favorited: false };
  return {
    likeCount: song._count.likes,
    viewCount: song.viewCount,
    liked: !!('likes' in song && song.likes?.length),
    favorited: !!('favorites' in song && song.favorites?.length),
  };
}

// Окно дедупликации просмотров: повторные открытия одним и тем же зрителем в
// пределах 12 часов не засчитываются.
const VIEW_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Кто смотрит: вошедший — по аккаунту, гость — по суточному отпечатку
 * (см. lib/visitor.ts). Тип-объединение, а не два опциональных поля: «ни
 * одного» и «оба сразу» — состояния бессмысленные, и их лучше не выражать.
 */
export type ViewerRef = { userId: string } | { visitorId: string };

/**
 * Засчитывает просмотр разбора: не чаще раза в 12 часов с одного зрителя.
 * Возвращает true, если просмотр был засчитан.
 *
 * Отметка ставится одним запросом: вставить либо обновить, только если окно
 * прошло. `ON CONFLICT ... WHERE` не даёт засчитать повторный просмотр, а
 * `RETURNING` сообщает, было ли что-то записано (иначе понадобился бы отдельный
 * SELECT). Ветки различаются лишь колонкой и целью конфликта — подставить имя
 * колонки параметром нельзя, поэтому запроса два.
 *
 * Отметка и денормализованный счётчик пишутся ОДНОЙ транзакцией. По отдельности
 * упавший инкремент оставлял отметку в базе, и она закрывала окно на 12 часов:
 * просмотр терялся насовсем, повторить его было нечем. Вдобавок `viewCount`
 * расходился с `count(View)`, а админская страница читает этот разрыв как
 * признак накрутки скриптом — то есть обычный сбой выглядел бы подделкой.
 */
export async function recordView(songId: string, viewer: ViewerRef): Promise<boolean> {
  const cutoff = new Date(Date.now() - VIEW_WINDOW_MS);
  const id = crypto.randomUUID();

  return prisma.$transaction(async (tx) => {
    const rows =
      'userId' in viewer
        ? await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "View" ("id", "userId", "songId", "viewedAt")
            VALUES (${id}, ${viewer.userId}, ${songId}, NOW())
            ON CONFLICT ("userId", "songId")
              DO UPDATE SET "viewedAt" = NOW()
              WHERE "View"."viewedAt" < ${cutoff}
            RETURNING "id"
          `
        : await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "View" ("id", "visitorId", "songId", "viewedAt")
            VALUES (${id}, ${viewer.visitorId}, ${songId}, NOW())
            ON CONFLICT ("visitorId", "songId")
              DO UPDATE SET "viewedAt" = NOW()
              WHERE "View"."viewedAt" < ${cutoff}
            RETURNING "id"
          `;

    if (rows.length === 0) return false; // просмотр уже был засчитан в окне
    await tx.song.update({ where: { id: songId }, data: { viewCount: { increment: 1 } } });
    return true;
  });
}
