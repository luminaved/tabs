import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';

export type SongVisibility = 'private' | 'unlisted' | 'public';

export interface SongInput {
  title: string;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  body: string;
  note?: string | null;
  coverUrl?: string | null;
  chordDefs?: string | null;
  visibility: SongVisibility;
}

function normalize(input: SongInput) {
  const coverUrl = input.coverUrl?.trim() || null;
  return {
    title: input.title.trim(),
    artist: input.artist?.trim() || null,
    key: input.key?.trim() || null,
    tempo: input.tempo ?? null,
    body: input.body,
    note: input.note?.trim() || null,
    coverUrl,
    hasCover: !!coverUrl, // держим флаг в согласии с картинкой
    chordDefs: input.chordDefs?.trim() || null,
    visibility: input.visibility,
  };
}

/**
 * «Мои песни» — только собственные разборы пользователя (любой видимости).
 * Текстовый поиск по названию/исполнителю — на стороне JS.
 */
export async function listSongs(viewerId: string, filters: { query?: string }) {
  const rows = await prisma.song.findMany({
    where: { userId: viewerId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      body: true,
      hasCover: true,
      visibility: true,
      updatedAt: true,
      viewCount: true,
      _count: { select: { likes: true } },
    },
  });

  const q = filters.query?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.title.toLowerCase().includes(q) || (r.artist ?? '').toLowerCase().includes(q),
  );
}

/** Сколько разборов отдаём в каталог за раз. */
const CATALOG_LIMIT = 60;

/** Порядок в каталоге: новые / популярные (просмотры) / любимые (лайки). */
export type SongSort = 'new' | 'views' | 'likes';

const SORT_ORDER: Record<SongSort, Prisma.SongOrderByWithRelationInput[]> = {
  new: [{ createdAt: 'desc' }],
  views: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
  likes: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
};

/** Приводит значение из query-параметра к допустимой сортировке. */
export function parseSort(value: string | undefined): SongSort {
  return value === 'views' || value === 'likes' ? value : 'new';
}

/**
 * Публичный каталог: только песни с visibility "public" (со всех аккаунтов).
 * Приватные и «по ссылке» сюда не попадают. Поиск — на стороне JS.
 */
export async function listPublicSongs(filters: {
  query?: string;
  key?: string;
  sort?: SongSort;
}) {
  const where: Prisma.SongWhereInput = {
    visibility: 'public',
    ...(filters.key ? { key: filters.key } : {}),
  };

  const rows = await prisma.song.findMany({
    where,
    orderBy: SORT_ORDER[filters.sort ?? 'new'],
    // Потолок выдачи: каталог не должен расти линейно вместе с базой.
    take: CATALOG_LIMIT,
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      body: true,
      hasCover: true,
      updatedAt: true,
      viewCount: true,
      user: { select: { id: true, name: true } },
      _count: { select: { likes: true } },
    },
  });

  const q = filters.query?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.title.toLowerCase().includes(q) || (r.artist ?? '').toLowerCase().includes(q),
  );
}

/**
 * Публичные разборы одного исполнителя. Исполнитель — свободное текстовое поле
 * на песне (отдельной модели нет), поэтому сравниваем без учёта регистра.
 */
export const listSongsByArtist = cache(async function listSongsByArtist(artist: string) {
  const name = artist.trim();
  if (!name) return [];
  return prisma.song.findMany({
    where: { visibility: 'public', artist: { equals: name, mode: 'insensitive' } },
    orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
    take: CATALOG_LIMIT,
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      body: true,
      hasCover: true,
      updatedAt: true,
      viewCount: true,
      _count: { select: { likes: true } },
    },
  });
});

/** Точное написание имени исполнителя, как оно хранится (для заголовка). */
export const findArtistName = cache(async function findArtistName(artist: string) {
  const name = artist.trim();
  if (!name) return null;
  const row = await prisma.song.findFirst({
    where: { visibility: 'public', artist: { equals: name, mode: 'insensitive' } },
    select: { artist: true },
  });
  return row?.artist ?? null;
});

/** Все исполнители с публичными разборами — для карты сайта. */
export async function listPublicArtists(): Promise<string[]> {
  const rows = await prisma.song.findMany({
    where: { visibility: 'public', artist: { not: null } },
    select: { artist: true },
    distinct: ['artist'],
  });
  return rows.map((r) => r.artist).filter((a): a is string => !!a?.trim());
}

/** Тональности публичных песен — для фильтра каталога. */
export async function listPublicKeys(): Promise<string[]> {
  const rows = await prisma.song.findMany({
    where: { key: { not: null }, visibility: 'public' },
    select: { key: true },
    distinct: ['key'],
  });
  return rows
    .map((r) => r.key)
    .filter((k): k is string => !!k)
    .sort((a, b) => a.localeCompare(b));
}

/** Тональности видимых песен — для фильтра. */
export async function listKeys(viewerId: string): Promise<string[]> {
  const rows = await prisma.song.findMany({
    where: { key: { not: null }, OR: [{ userId: viewerId }, { visibility: 'public' }] },
    select: { key: true },
    distinct: ['key'],
  });
  return rows
    .map((r) => r.key)
    .filter((k): k is string => !!k)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Просмотр с учётом видимости: private — только владельцу.
 * coverUrl (тяжёлый base64) не выбираем — картинку отдаёт /covers/[id].
 *
 * Обёрнуто в cache(): страница и generateMetadata запрашивают одну и ту же
 * песню, без дедупликации это лишний поход в БД на каждую загрузку.
 */
export const getSongForViewer = cache(async function getSongForViewer(
  id: string,
  viewerId?: string,
) {
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      tempo: true,
      body: true,
      note: true,
      chordDefs: true,
      hasCover: true,
      visibility: true,
      viewCount: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!song) return null;
  if (song.visibility === 'private' && song.userId !== viewerId) return null;
  return song;
});

/** Строго своя песня (для редактирования). */
export async function getOwnedSong(id: string, userId: string) {
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song || song.userId !== userId) return null;
  return song;
}

export function createSong(userId: string, input: SongInput) {
  return prisma.song.create({ data: { ...normalize(input), userId } });
}

export async function updateSong(id: string, userId: string, input: SongInput) {
  const existing = await prisma.song.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return null;
  return prisma.song.update({ where: { id }, data: normalize(input) });
}

export async function deleteSong(id: string, userId: string) {
  const existing = await prisma.song.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return false;
  await prisma.song.delete({ where: { id } });
  return true;
}
