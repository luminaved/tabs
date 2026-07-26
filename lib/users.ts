import { cache } from 'react';
import { prisma } from './db';

/**
 * Профиль для кабинета. cache(): страница кабинета и шапка спрашивают одного
 * и того же пользователя — без дедупликации это лишний поход в БД.
 */
export const getUserProfile = cache(function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, createdAt: true },
  });
});

/**
 * Публичные данные пользователя (для страницы автора и шапки).
 * cache(): шапка есть на каждой странице, а /u/[id] спрашивает автора дважды
 * (в generateMetadata и в самой странице).
 */
export const getPublicUser = cache(function getPublicUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });
});

export async function updateUserProfile(
  userId: string,
  data: { name: string | null; image: string | null },
) {
  await prisma.user.update({ where: { id: userId }, data });
}
