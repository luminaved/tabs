'use server';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

/**
 * Подтверждение разбора модератором: аккорды верны и песня под них поётся.
 *
 * Как и лайк, ничего не ревалидирует — иначе роутер перерисовал бы страницу и
 * сбросил транспонирование с прокруткой. Новое состояние возвращается ответом.
 *
 * `updatedAt` переносим прежний, а не даём Prisma проставить текущее время:
 * модерация — не правка разбора. Иначе подтверждение выбрасывало бы песню
 * наверх авторской библиотеки (она сортируется по `updatedAt`), меняло
 * `lastModified` в карте сайта и версию в ссылке на обложку, сбрасывая её кэш.
 * Явное значение поля с `@updatedAt` Prisma не перетирает.
 */
export async function toggleVerifiedAction(songId: string): Promise<{ verified: boolean }> {
  await requireAdmin();
  if (!songId) return { verified: false };

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { verified: true, updatedAt: true },
  });
  if (!song) return { verified: false };

  const verified = !song.verified;
  await prisma.song.update({
    where: { id: songId },
    data: { verified, verifiedAt: verified ? new Date() : null, updatedAt: song.updatedAt },
  });
  return { verified };
}
