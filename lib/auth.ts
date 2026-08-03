import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Yandex from 'next-auth/providers/yandex';
import { telegramDisplayName, verifyTelegramAuth } from './telegram';
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
 * Telegram. Здесь одна переменная, а не пара: подпись проверяется токеном бота,
 * никакого «секрета приложения» у Telegram нет.
 *
 * Имя бота нужно только виджету на странице входа — им он подписывает кнопку.
 */
export const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
/**
 * Имя бота — ОБЫЧНАЯ серверная переменная, без префикса NEXT_PUBLIC_.
 *
 * С префиксом здесь была ловушка: такие переменные Next подставляет в код на
 * этапе СБОРКИ, а не читает при запуске. Значит сборка, прошедшая раньше, чем
 * переменную завели в панели хостинга, навсегда уносила с собой `undefined`, и
 * кнопка не появлялась, сколько ни правь настройки, — до следующей пересборки.
 * Публичной ей быть незачем: значение нужно только серверу, чтобы подставить
 * атрибут виджету.
 */
export const telegramBotName = process.env.TELEGRAM_BOT_NAME ?? '';
export const telegramEnabled = !!(telegramBotToken && telegramBotName);

// Задана ровно одна переменная из двух — почти наверняка опечатка или забытая
// половина настройки. Молча прятать кнопку в этом случае хуже всего: снаружи
// это неотличимо от «вход не настраивали вовсе». Пишем в лог сервера (не
// пользователю: наружу состав настроек не показываем).
if (!!telegramBotToken !== !!telegramBotName) {
  console.warn(
    '[auth] Вход через Telegram выключен: задана только одна переменная из двух — ' +
      `TELEGRAM_BOT_TOKEN=${telegramBotToken ? 'есть' : 'НЕТ'}, ` +
      `TELEGRAM_BOT_NAME=${telegramBotName ? 'есть' : 'НЕТ'}.`,
  );
}

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
 * Провайдер Telegram.
 *
 * Telegram не OAuth: виджет отдаёт поля профиля прямо в браузер, подписанные
 * ключом бота. Поэтому провайдер здесь Credentials — но «учётные данные» тут
 * не пара логин-пароль, а подписанный ответ Telegram.
 *
 * Пользователя и запись Account заводим САМИ: адаптер Prisma создаёт их только
 * для OAuth-провайдеров, а Credentials проходит мимо него. Связка живёт в той
 * же таблице Account, что и остальные входы, — заводить отдельную колонку на
 * User ради этого незачем.
 */
function telegramProvider() {
  return Credentials({
    id: 'telegram',
    name: 'Telegram',
    // Поля объявляем, но форму Auth.js не рисует: их заполняет виджет.
    credentials: {
      id: {},
      first_name: {},
      last_name: {},
      username: {},
      photo_url: {},
      auth_date: {},
      hash: {},
    },
    authorize: async (credentials) => {
      const raw = Object.fromEntries(
        Object.entries(credentials ?? {}).map(([k, v]) => [k, v == null ? undefined : String(v)]),
      );

      const check = verifyTelegramAuth(raw, telegramBotToken);
      // Причину отказа наружу не отдаём: подделке незачем знать, что именно
      // не сошлось. В лог она попадает как обычная неудача входа.
      if (!check.ok) return null;

      const tg = check.profile;
      const existing = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'telegram', providerAccountId: tg.id } },
        select: { user: { select: { id: true, name: true, email: true } } },
      });
      if (existing) return existing.user;

      // Нового заводим без адреса — Telegram его не отдаёт вовсе (ради этого
      // `User.email` и сделан необязательным).
      const user = await prisma.user.create({
        data: {
          name: telegramDisplayName(tg),
          // Картинку берём ссылкой; к себе её перенесёт общий механизм
          // (lib/remoteAvatar.ts), как и у Google.
          image: tg.photo_url ?? null,
          accounts: {
            create: { type: 'oauth', provider: 'telegram', providerAccountId: tg.id },
          },
        },
        select: { id: true, name: true, email: true },
      });
      return user;
    },
  });
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
    // Яндекс — на тех же основаниях: адрес приходит подтверждённым (это его
    // собственная почта), поэтому склейка с уже существующим аккаунтом по email
    // не даёт чужому человеку зайти под вашей учёткой.
    ...(yandexEnabled ? [Yandex({ allowDangerousEmailAccountLinking: true })] : []),
    // Telegram — не OAuth, поэтому Credentials: виджет отдаёт поля профиля с
    // подписью, и всё доверие держится на её проверке (см. lib/telegram.ts).
    ...(telegramEnabled ? [telegramProvider()] : []),
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
