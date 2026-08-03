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

  // Сбрасываем по ШАБЛОНУ маршрута, а не по собранному адресу: адрес разбора
  // теперь с подписью (`/songs/<подпись>-<id>`), и строка `/songs/<id>` ему
  // больше не соответствует — сброс уходил в пустоту. Шаблон верен независимо
  // от того, как подпись выглядит сегодня.
  revalidatePath('/songs/[id]', 'page');
  return { ok: true };
}

/**
 * Удаление заметки. Как и у разбора: кнопка есть только у владельца, поэтому
 * отказ — гонка либо подмена id, а не обычный ход событий. Молча ревалидировать
 * страницу и показать заметку на месте было бы хуже видимой ошибки.
 */
export async function deleteAnnotationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  const deleted = await deleteAnnotation(user.id, id);
  if (!deleted) throw new Error('Заметка не найдена или нет доступа');

  // Сбрасываем по ШАБЛОНУ маршрута, а не по собранному адресу: адрес разбора
  // теперь с подписью (`/songs/<подпись>-<id>`), и строка `/songs/<id>` ему
  // больше не соответствует — сброс уходил в пустоту. Шаблон верен независимо
  // от того, как подпись выглядит сегодня.
  revalidatePath('/songs/[id]', 'page');
}
