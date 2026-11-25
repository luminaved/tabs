import { cache } from 'react';
import NextAuth, { type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Yandex from 'next-auth/providers/yandex';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './db';
import { verifyPassword } from './password';
import { normalizeEmail } from './validation';
import { clear, hit } from './rateLimit';
import { clientIpFrom } from './visitor';

/** Google-вход доступен, только если заданы креды (см. .env / README). */
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/** Яндекс — там же и так же. Имена переменных задаёт Auth.js: AUTH_<ПРОВАЙДЕР>_ID/SECRET. */
export const yandexEnabled = !!(process.env.AUTH_YANDEX_ID && process.env.AUTH_YANDEX_SECRET);

/**
 * Попытки входа с одного адреса за 15 минут. Живому человеку, забывшему пароль,
 * десятка хватает с запасом; перебору — нет.
 */
export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Ключ лимита. Общий с формой входа — она по нему объясняет отказ. */
export function loginRateKey(ip: string): string {
  return `login:${ip || 'no-ip'}`;
}

/**
 * Auth.js (v5). Вход по email + паролю (Credentials) + Google и Яндекс (опц.).
 *
 * Стратегия сессии — JWT: провайдер Credentials несовместим с сессиями в БД
 * (ограничение Auth.js). Адаптер Prisma управляет пользователями и OAuth-аккаунтами.
 */
const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      /**
       * Счётчик попыток стоит ЗДЕСЬ, а не в серверном экшене формы.
       *
       * Экшен — лишь один из двух путей входа: провайдер Credentials висит на
       * публичном `POST /api/auth/callback/credentials`, и туда можно стучаться
       * напрямую, взяв токен из `/api/auth/csrf`. Пока лимит жил в экшене, этот
       * путь его просто обходил — вместе со всем смыслом лимита, потому что
       * bcrypt считается как раз ниже (см. lib/password.ts). `authorize` —
       * единственное место, через которое проходят оба пути.
       *
       * Отказ по лимиту возвращает `null`, как и неверный пароль: снаружи они
       * неразличимы, и перебор не получает обратной связи о том, что его
       * заметили. Человеку у формы объяснение всё же нужно — его подставляет
       * loginAction, заглядывая в тот же счётчик через `retryAfter`.
       */
      authorize: async (credentials, request) => {
        const key = loginRateKey(clientIpFrom((n) => request.headers.get(n)));
        if (!(await hit(key, LOGIN_LIMIT, LOGIN_WINDOW_MS)).ok) return null;

        const email = normalizeEmail(String(credentials?.email ?? ''));
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Вход удался — счётчик снимаем: лимит заведён против перебора, а
        // человек, знающий пароль, — не перебор. Иначе за одним внешним адресом
        // (офис, NAT, мобильный оператор) десяток обычных входов подряд закрывал
        // бы форму всем остальным.
        await clear(key);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Google подключается только при наличии кредов. Линковка по email
    // безопасна: Google подтверждает адреса.
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
    // Яндекс — на тех же основаниях: адрес приходит подтверждённым (это его
    // собственная почта), поэтому склейка с уже существующим аккаунтом по email
    // не даёт чужому человеку зайти под вашей учёткой.
    ...(yandexEnabled ? [Yandex({ allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = String(token.id);
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * Сессия текущего запроса.
 *
 * Обёрнута в `cache()`, и это не украшение. Сессия здесь живёт в JWT внутри
 * cookie, а `auth()` каждый раз её РАСШИФРОВЫВАЕТ (A256GCM поверх ключа,
 * выведенного HKDF). Спрашивают её на одной странице разбора шесть раз: шапка,
 * нижняя навигация, два layout'а, `generateMetadata` и сама страница — и до
 * этой обёртки каждый спрашивающий платил за расшифровку заново, хотя cookie
 * одна и та же и ответ обязан совпадать. `cache()` из React живёт ровно в
 * пределах одного запроса, так что разные посетители ничего друг у друга не
 * увидят.
 *
 * Объявлена как функция без аргументов намеренно: `auth` из Auth.js умеет ещё
 * оборачивать обработчики маршрутов и middleware, но так им здесь никто не
 * пользуется, а кэшировать обёртку было бы бессмысленно и опасно.
 */
export const auth = cache((): Promise<Session | null> => nextAuth.auth());
