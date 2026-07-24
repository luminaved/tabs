import { prisma } from './db';

export type AnnotationTypeValue = 'technique' | 'rhythm' | 'transition' | 'note';

export interface AnnotationView {
  id: string;
  anchor: string;
  text: string;
  type: string | null;
}

export interface AnnotationInput {
  songId: string;
  anchor: string;
  text: string;
  type?: AnnotationTypeValue | null;
}

/** Заметки песни (личные — доступны только владельцу, гейт делает вызывающий код). */
export function listBySong(songId: string): Promise<AnnotationView[]> {
  return prisma.annotation.findMany({
    where: { songId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, anchor: true, text: true, type: true },
  });
}

async function ownsSong(songId: string, userId: string): Promise<boolean> {
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { userId: true } });
  return !!song && song.userId === userId;
}

export async function createAnnotation(userId: string, input: AnnotationInput) {
  if (!(await ownsSong(input.songId, userId))) return null;
  return prisma.annotation.create({
    data: {
      songId: input.songId,
      anchor: input.anchor,
      text: input.text.trim(),
      type: input.type ?? null,
    },
  });
}

export async function deleteAnnotation(userId: string, id: string) {
  const ann = await prisma.annotation.findUnique({
    where: { id },
    select: { song: { select: { userId: true } } },
  });
  if (!ann || ann.song.userId !== userId) return false;
  await prisma.annotation.delete({ where: { id } });
  return true;
}
