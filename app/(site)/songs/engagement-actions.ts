'use server';

import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleFavorite, toggleLike } from '@/lib/engagement';

/**
 * Переключатели лайка и избранного.
 *
 * Намеренно БЕЗ `revalidatePath` и БЕЗ `revalidateTag`: любая ревалидация в
 * серверном экшене заставляет роутер перерисовать текущий маршрут, а вместе с
 * ним сбрасывались транспонирование, размер шрифта и позиция прокрутки
 * читалки. Вместо этого экшен возвращает новое состояние, а страница
 * показывает его оптимистично.
 *
 * Число лайков при этом попадает в каталог (там есть сортировка «популярные»),
 * а каталог с некоторых пор лежит в кэше данных — то есть отстаёт. Отстаёт
 * ровно на срок годности кэша, минуту (PUBLIC_TTL в lib/cache.ts), и это
 * сознательный размен: перерисовка читалки под пальцами читателя хуже, чем
 * счётчик лайков, догоняющий за минуту.
 */

/**
 * `null` — сделать ничего не вышло, состояние на странице менять нечем.
 *
 * Отдельно от «не лайкнуто», и это важно в обе стороны. Раньше отказ отвечал
 * `{ liked: false, likeCount: 0 }`, страница честно вписывала эти числа себе —
 * и ВИДИМЫЙ счётчик лайков падал в ноль на ровном месте (например, когда разбор
 * удалили из соседней вкладки). Наружу же `null` по-прежнему не различает «нет
 * доступа» и «нет разбора»: перебор id не получает подсказки.
 */
export async function toggleLikeAction(
  songId: string,
): Promise<{ liked: boolean; likeCount: number } | null> {
  const user = await requireUser();
  if (!songId) return null;

  const liked = await toggleLike(user.id, songId);
  if (liked === null) return null;

  // Счётчик перечитываем, а не считаем на клиенте: лайкать могли параллельно.
  const likeCount = await prisma.like.count({ where: { songId } });
  return { liked, likeCount };
}

export async function toggleFavoriteAction(
  songId: string,
): Promise<{ favorited: boolean } | null> {
  const user = await requireUser();
  if (!songId) return null;

  const favorited = await toggleFavorite(user.id, songId);
  if (favorited === null) return null;
  return { favorited };
}
