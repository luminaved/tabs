'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { createAnnotation, deleteAnnotation, type AnnotationTypeValue } from '@/lib/annotations';

export interface AnnotationState {
  error?: string;
  ok?: boolean;
}

const TYPES: AnnotationTypeValue[] = ['technique', 'rhythm', 'transition', 'note'];

export async function createAnnotationAction(
  _prev: AnnotationState,
  formData: FormData,
): Promise<AnnotationState> {
  const user = await requireUser();
  const songId = String(formData.get('songId') ?? '');
  const anchor = String(formData.get('anchor') ?? '');
  const text = String(formData.get('text') ?? '').trim();
  const t = String(formData.get('type') ?? 'note');
  const type = (TYPES as string[]).includes(t) ? (t as AnnotationTypeValue) : 'note';

  if (!text) return { error: 'Пустая заметка' };

  const created = await createAnnotation(user.id, { songId, anchor, text, type });
  if (!created) return { error: 'Нет доступа' };

  revalidatePath(`/songs/${songId}`);
  return { ok: true };
}

export async function deleteAnnotationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const songId = String(formData.get('songId') ?? '');
  await deleteAnnotation(user.id, id);
  revalidatePath(`/songs/${songId}`);
}
