'use server';

import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleFavorite, toggleLike } from '@/lib/engagement';

/**
 * Переключатели лайка и избранного.
 *
 * Намеренно БЕЗ `revalidatePath`: любая ревалидация в серверном экшене
 * заставляет роутер перерисовать текущий маршрут, а вместе с ним сбрасывались
 * транспонирование, размер шрифта и позиция прокрутки читалки. Вместо этого
 * экшен возвращает новое состояние, а страница показывает его оптимистично.
 *
 * Каталог от этого не устаревает: он рендерится динамически на каждый запрос,
 * поэтому кэш маршрута инвалидировать нечего.
 */

export async function toggleLikeAction(
  songId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const user = await requireUser();
  if (!songId) return { liked: false, likeCount: 0 };

  const liked = await toggleLike(user.id, songId);
  // null — разбора нет или он чужой приватный. Отвечаем «не лайкнуто», а не
  // ошибкой: перебор id не должен различать «нет доступа» и «нет разбора».
  if (liked === null) return { liked: false, likeCount: 0 };

  // Счётчик перечитываем, а не считаем на клиенте: лайкать могли параллельно.
  const likeCount = await prisma.like.count({ where: { songId } });
  return { liked, likeCount };
}

export async function toggleFavoriteAction(songId: string): Promise<{ favorited: boolean }> {
  const user = await requireUser();
  if (!songId) return { favorited: false };

  const favorited = await toggleFavorite(user.id, songId);
  return { favorited: favorited ?? false };
}
