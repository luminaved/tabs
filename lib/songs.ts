import type { Prisma } from '@prisma/client';
import { prisma } from './db';

export type SongVisibility = 'private' | 'unlisted' | 'public';

export interface SongInput {
  title: string;
  artist?: string | null;
  key?: string | null;
  capo?: number;
  tempo?: number | null;
  body: string;
  note?: string | null;
  coverUrl?: string | null;
  visibility: SongVisibility;
}

function normalize(input: SongInput) {
  return {
    title: input.title.trim(),
    artist: input.artist?.trim() || null,
    key: input.key?.trim() || null,
    capo: input.capo ?? 0,
    tempo: input.tempo ?? null,
    body: input.body,
    note: input.note?.trim() || null,
    coverUrl: input.coverUrl?.trim() || null,
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
      coverUrl: true,
      visibility: true,
      updatedAt: true,
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
 * Публичный каталог: только песни с visibility "public" (со всех аккаунтов).
 * Приватные и «по ссылке» сюда не попадают. Поиск — на стороне JS.
 */
export async function listPublicSongs(filters: { query?: string; key?: string }) {
  const where: Prisma.SongWhereInput = {
    visibility: 'public',
    ...(filters.key ? { key: filters.key } : {}),
  };

  const rows = await prisma.song.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      artist: true,
      key: true,
      body: true,
      coverUrl: true,
      updatedAt: true,
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

/** Просмотр с учётом видимости: private — только владельцу. */
export async function getSongForViewer(id: string, viewerId?: string) {
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) return null;
  if (song.visibility === 'private' && song.userId !== viewerId) return null;
  return song;
}

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
