import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './db';
import { verifyPassword } from './password';
import { normalizeEmail } from './validation';
import { clear, hit } from './rateLimit';
import { clientIpFrom } from './visitor';

/** Google-вход доступен, только если заданы креды (см. .env / README). */
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

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
 * Auth.js (v5). Вход по email + паролю (Credentials) + Google OAuth (опц.).
 *
 * Стратегия сессии — JWT: провайдер Credentials несовместим с сессиями в БД
 * (ограничение Auth.js). Адаптер Prisma управляет пользователями и OAuth-аккаунтами.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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
