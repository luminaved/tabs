'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AuthError } from 'next-auth';
import { Prisma } from '@prisma/client';
import { googleEnabled, LOGIN_LIMIT, loginRateKey, signIn } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail, validateEmail, validatePassword } from '@/lib/validation';
import { hit, retryAfter } from '@/lib/rateLimit';
import { clientIpFrom } from '@/lib/visitor';

export interface AuthFormState {
  error?: string;
}

// Регистрация дороже (bcrypt + запись) и злоупотребление ею заметнее — лимит
// строже и окно длиннее. В отличие от входа, её считаем прямо здесь: другого
// пути к созданию аккаунта с паролем нет, экшен и есть единственная дверь.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

/**
 * Текст отказа. Одинаковый и для входа, и для регистрации: он не должен
 * подсказывать, существует ли адрес.
 */
function tooManyAttempts(retryAfter: number): AuthFormState {
  const minutes = Math.ceil(retryAfter / 60);
  return { error: `Слишком много попыток. Попробуйте через ${minutes} мин.` };
}

/**
 * Адрес клиента для ключа лимита. Без заголовков прокси (локальная разработка)
 * все запросы сливаются в один ключ — там это и не мешает.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFrom((n) => h.get(n)) || 'no-ip';
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
      // Сам счётчик крутится в `authorize` (см. lib/auth.ts) — он единственная
      // точка, через которую проходят оба пути входа. Здесь только заглядываем
      // в него, чтобы отличить исчерпанный лимит от обычной опечатки: наружу
      // Auth.js отдаёт и то и другое одинаково.
      const wait = await retryAfter(loginRateKey(await clientIp()), LOGIN_LIMIT);
      if (wait > 0) return tooManyAttempts(wait);
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

  // После проверки формы, но до bcrypt и записи: опечатку в пароле не считаем
  // за попытку регистрации, а вот дорогие шаги уже прикрываем.
  const limit = await hit(`register:${await clientIp()}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!limit.ok) return tooManyAttempts(limit.retryAfter);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'Пользователь с таким email уже существует' };

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({ data: { email, name, passwordHash } });
  } catch (error) {
    // Между проверкой выше и вставкой адрес мог занять параллельный запрос
    // (две отправки формы подряд — обычное дело). Уникальный индекс отработает,
    // но без этой ветки пользователь получил бы 500 вместо понятного текста.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'Пользователь с таким email уже существует' };
    }
    throw error;
  }

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
