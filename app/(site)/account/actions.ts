'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { updateUserProfile } from '@/lib/users';

export interface ProfileState {
  ok?: boolean;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim() || null;

  // Аватар: загруженный (data:image/) или из Google (https). Иначе — убрать.
  const raw = String(formData.get('image') ?? '').trim();
  const image = raw.startsWith('data:image/') || raw.startsWith('https://') ? raw : null;

  await updateUserProfile(user.id, { name, image });
  revalidatePath('/account');
  return { ok: true };
}
