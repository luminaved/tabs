import { Prisma } from '@prisma/client';
import { prisma } from './db';

// Поля песни для строки списка (каталог/кабинет).
const cardSelect = {
  id: true,
  title: true,
  artist: true,
  key: true,
  coverUrl: true,
  body: true,
  _count: { select: { likes: true } },
} satisfies Prisma.SongSelect;

export type SongCard = Prisma.SongGetPayload<{ select: typeof cardSelect }>;

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
  return rows.map((r) => r.song);
}

/** Лайкнутые песни пользователя. */
export async function listLikedSongs(userId: string): Promise<SongCard[]> {
  const rows = await prisma.like.findMany({
    where: { userId, song: visibleToUser(userId) },
    orderBy: { createdAt: 'desc' },
    select: { song: { select: cardSelect } },
  });
  return rows.map((r) => r.song);
}

/** Публичные разборы пользователя (для страницы автора). */
export function listUserPublicSongs(userId: string): Promise<SongCard[]> {
  return prisma.song.findMany({
    where: { userId, visibility: 'public' },
    orderBy: { updatedAt: 'desc' },
    select: cardSelect,
  });
}

/** Счётчики для кабинета: избранное, лайкнутое, свои песни. */
export async function getLibraryCounts(userId: string) {
  const [favorites, liked, own] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.like.count({ where: { userId } }),
    prisma.song.count({ where: { userId } }),
  ]);
  return { favorites, liked, own };
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
  liked: boolean;
  favorited: boolean;
}

/** Кол-во лайков + отметки текущего пользователя (если он есть). */
export async function getSongEngagement(
  songId: string,
  userId?: string,
): Promise<SongEngagement> {
  const likeCount = await prisma.like.count({ where: { songId } });
  if (!userId) return { likeCount, liked: false, favorited: false };

  const [like, favorite] = await Promise.all([
    prisma.like.findUnique({ where: { userId_songId: { userId, songId } } }),
    prisma.favorite.findUnique({ where: { userId_songId: { userId, songId } } }),
  ]);
  return { likeCount, liked: !!like, favorited: !!favorite };
}
