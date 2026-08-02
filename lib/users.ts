import { cache } from 'react';
import { prisma } from './db';
import { AVATAR_TAIL_CHARS, avatarVersionFromParts } from './avatarUrl';

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

/** Публичные данные пользователя, как их видит разметка. */
export interface PublicUser {
  name: string | null;
  /** Отпечаток аватара для ссылки на /avatars/[id]; null — аватара нет. */
  avatarVersion: string | null;
}

/**
 * Публичные данные пользователя (для страницы автора и шапки).
 *
 * Саму картинку НЕ выбираем. Она лежит в `User.image` как data URL, а шапка
 * рисуется на каждой странице — то есть весь base64 ездил из базы (а база в
 * другом полушарии) на каждую загрузку любой страницы. Замерено на живых
 * данных: в среднем ~5 КБ, до 17 КБ на аккаунт. При этом разметке картинка не
 * нужна вовсе: аватар уходит ссылкой на /avatars/[id], а от самого файла нужен
 * только отпечаток для `?v=` — а он считается по длине и последним 128
 * символам (см. lib/avatarUrl.ts).
 *
 * Тот же приём, что уже применён к обложкам: списки берут флаг `hasCover`, а не
 * `coverUrl` (см. cardSelect в lib/engagement.ts).
 *
 * Отсюда сырой SQL: `length()` и `right()` в select у Prisma не выразить.
 * Postgres считает символы, JS — единицы UTF-16; для data URL и адресов Google
 * это только ASCII, так что длины совпадают.
 *
 * `::int` у длины хвоста обязателен: параметры Prisma подставляет как bigint, а
 * `right(text, bigint)` в Postgres просто нет — без приведения запрос падает.
 *
 * cache(): шапка есть на каждой странице, а /u/[id] спрашивает автора дважды
 * (в generateMetadata и в самой странице).
 */
export const getPublicUser = cache(async function getPublicUser(
  userId: string,
): Promise<PublicUser | null> {
  const rows = await prisma.$queryRaw<
    { name: string | null; imageLength: number | null; imageTail: string | null }[]
  >`
    SELECT "name",
           length("image")::int AS "imageLength",
           right("image", ${AVATAR_TAIL_CHARS}::int) AS "imageTail"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    name: row.name,
    avatarVersion:
      row.imageLength && row.imageTail !== null
        ? avatarVersionFromParts(row.imageLength, row.imageTail)
        : null,
  };
});

export async function updateUserProfile(
  userId: string,
  data: { name: string | null; image: string | null },
) {
  await prisma.user.update({ where: { id: userId }, data });
}
