'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { googleEnabled, signIn } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail, validateEmail, validatePassword } from '@/lib/validation';

export interface AuthFormState {
  error?: string;
}

export async function googleSignInAction(): Promise<void> {
  // Google подключается кредами AUTH_GOOGLE_ID/SECRET. Пока их нет — понятное
  // сообщение вместо ошибки Google.
  if (!googleEnabled) {
    redirect('/login?google=unconfigured');
  }
  await signIn('google', { redirectTo: '/' });
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
    return {};
  } catch (error) {
    // Ошибка авторизации — показываем текст. Редирект от signIn пробрасываем.
    if (error instanceof AuthError) {
      return { error: 'Неверный email или пароль' };
    }
    throw error;
  }
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim() || null;

  if (!validateEmail(email)) return { error: 'Введите корректный email' };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'Пользователь с таким email уже существует' };

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, name, passwordHash } });

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Аккаунт создан, но авто-вход не удался — отправим на страницу входа.
      return { error: 'Аккаунт создан. Войдите, пожалуйста.' };
    }
    throw error;
  }
}
