import { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { InstrumentId } from './chords/instruments';
import { searchQueryForLike } from './chordpro/searchText';
import { withChordChips } from './chordpro/usedChords';

// Поля песни для строки списка (каталог/кабинет).
// Внимание: coverUrl (тяжёлый base64) здесь НЕ выбирается — списки берут только
// флаг hasCover, а картинка приходит отдельным кэшируемым запросом /covers/[id].
// `body` нужен только чтобы посчитать чипы аккордов, наружу уходит уже готовый
// список (см. `withChordChips`).
const cardSelect = {
  id: true,
  title: true,
  artist: true,
  key: true,
  hasCover: true,
  instrument: true,
  verified: true,
  updatedAt: true,
  body: true,
  viewCount: true,
  _count: { select: { likes: true } },
} satisfies Prisma.SongSelect;

type SongCardRecord = Prisma.SongGetPayload<{ select: typeof cardSelect }>;

/** Строка списка, как её получает разметка: со списком аккордов вместо текста. */
export type SongCard = Omit<SongCardRecord, 'body'> & { chords: string[] };

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
  filters: { instrument?: InstrumentId; query?: string } = {},
): Promise<SongCard[]> {
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
    orderBy: { updatedAt: 'desc' },
    select: cardSelect,
  });
  return rows.map(withChordChips);
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

/** Переключить лайк. Возвращает true, если стало «лайкнуто». */
export async function toggleLike(userId: string, songId: string): Promise<boolean> {
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

/** Переключить избранное. Возвращает true, если стало «в избранном». */
export async function toggleFavorite(userId: string, songId: string): Promise<boolean> {
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

// Окно дедупликации просмотров: повторные открытия с того же аккаунта в
// пределах 12 часов не засчитываются.
const VIEW_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Засчитывает просмотр разбора: не чаще раза в 12 часов с одного аккаунта.
 * Возвращает true, если просмотр был засчитан. Анонимы не учитываются
 * (нужен аккаунт, иначе счётчик легко накрутить).
 */
export async function recordView(songId: string, userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - VIEW_WINDOW_MS);

  // Одним запросом: вставить отметку или обновить её, только если прошло окно.
  // ON CONFLICT ... WHERE не даёт засчитать повторный просмотр, а RETURNING
  // сообщает, было ли что-то записано (иначе понадобился бы отдельный SELECT).
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "View" ("id", "userId", "songId", "viewedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${songId}, NOW())
    ON CONFLICT ("userId", "songId")
      DO UPDATE SET "viewedAt" = NOW()
      WHERE "View"."viewedAt" < ${cutoff}
    RETURNING "id"
  `;

  if (rows.length === 0) return false; // просмотр уже был засчитан в окне
  await prisma.song.update({ where: { id: songId }, data: { viewCount: { increment: 1 } } });
  return true;
}
