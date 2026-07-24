import { prisma } from './db';

export function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, createdAt: true },
  });
}

/** Публичные данные пользователя (для страницы автора). */
export function getPublicUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });
}

export async function updateUserProfile(
  userId: string,
  data: { name: string | null; image: string | null },
) {
  await prisma.user.update({ where: { id: userId }, data });
}
