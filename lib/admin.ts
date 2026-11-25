import { cache } from 'react';
import { prisma } from './db';
import { auth } from './auth';

/**
 * Права администратора.
 *
 * Роль держим в БД (`User.role`), а не в JWT-сессии: токен живёт долго и после
 * выдачи прав обновился бы только при следующем входе. Запрос дешёвый и
 * обёрнут в cache(), поэтому на страницу приходится один поход в базу.
 */

export const isAdminUser = cache(async function isAdminUser(userId?: string | null) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'admin';
});

/** Админ ли текущий посетитель. Для гостя — false, без исключений. */
export async function currentUserIsAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdminUser(session?.user?.id);
}

/**
 * Гейт для серверных экшенов: возвращает id админа либо бросает.
 * Бросаем, а не редиректим: сюда попадают только по кнопке, которой у обычного
 * пользователя нет, поэтому это уже не сценарий интерфейса, а обход.
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !(await isAdminUser(userId))) {
    throw new Error('Недостаточно прав');
  }
  return userId;
}
