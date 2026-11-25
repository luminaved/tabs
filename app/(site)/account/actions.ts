'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { updateUserProfile } from '@/lib/users';
import { parseAvatarInput } from '@/lib/imageInput';
import { parseDisplayName } from '@/lib/validation';

export interface ProfileState {
  ok?: boolean;
  error?: string;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  // Разбор имени общий с регистрацией (см. lib/validation.ts): потолок,
  // стоявший только здесь, обходился формой регистрации.
  const parsed = parseDisplayName(String(formData.get('name') ?? ''));
  if ('error' in parsed) return { error: parsed.error };
  const name = parsed.name;

  // Аватар: своё фото (data URL в пределах лимита) либо картинка провайдера
  // входа. Проверка размера и хоста — в lib/imageInput.ts: раньше сюда
  // проходил любой `https://`, то есть аватар мог стать чужим трекером.
  //
  // Три состояния, и они разные:
  //   поля нет вовсе — картинку не трогали (форма её и не присылает, см.
  //                    AvatarInput: возить туда-сюда чужие 17 КБ незачем);
  //   поле пустое    — попросили убрать;
  //   поле с данными — поставить новую.
  const field = formData.get('image');
  let image: string | null | undefined;
  if (field !== null) {
    const raw = String(field).trim();
    image = raw ? parseAvatarInput(raw) : null;
    if (raw && !image) {
      return { error: 'Фото слишком большое или в неподдерживаемом формате' };
    }
  }

  await updateUserProfile(user.id, { name, image });
  revalidatePath('/account');
  return { ok: true };
}
