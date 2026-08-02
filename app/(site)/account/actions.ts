'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { updateUserProfile } from '@/lib/users';
import { parseAvatarInput } from '@/lib/imageInput';

export interface ProfileState {
  ok?: boolean;
  error?: string;
}

/** Отображаемое имя показывается в шапке и списках — длинному там не место. */
const NAME_MAX = 80;

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const name = String(formData.get('name') ?? '').trim() || null;
  if (name && name.length > NAME_MAX) {
    return { error: `Имя длиннее ${NAME_MAX} символов` };
  }

  // Аватар: своё фото (data URL в пределах лимита) либо картинка провайдера
  // входа. Проверка размера и хоста — в lib/imageInput.ts: раньше сюда
  // проходил любой `https://`, то есть аватар мог стать чужим трекером.
  const raw = String(formData.get('image') ?? '').trim();
  const image = parseAvatarInput(raw);
  if (raw && !image) {
    return { error: 'Фото слишком большое или в неподдерживаемом формате' };
  }

  await updateUserProfile(user.id, { name, image });
  revalidatePath('/account');
  return { ok: true };
}
