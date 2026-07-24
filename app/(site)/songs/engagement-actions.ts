'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { toggleFavorite, toggleLike } from '@/lib/engagement';

export async function toggleLikeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const songId = String(formData.get('songId') ?? '');
  if (!songId) return;
  await toggleLike(user.id, songId);
  revalidatePath(`/songs/${songId}`);
  revalidatePath('/'); // счётчик лайков в каталоге
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const songId = String(formData.get('songId') ?? '');
  if (!songId) return;
  await toggleFavorite(user.id, songId);
  revalidatePath(`/songs/${songId}`);
}
