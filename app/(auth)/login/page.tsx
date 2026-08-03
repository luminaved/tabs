import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { TelegramLoginButton } from '@/components/TelegramLoginButton';
import { loginAction } from '../actions';

// Страница входа закрыта и в robots.txt, но `noindex` здесь не дублирование:
// robots.txt запрещает ОБХОД, а не показ, и адрес, на который где-то ведёт
// ссылка, попадает в выдачу и без обхода — голым заголовком. Мета-тег
// закрывает именно показ.
export const metadata: Metadata = {
  title: 'Вход',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string;
    yandex?: string;
    telegram?: string;
  }>;
}) {
  const sp = await searchParams;

  // Сюда возвращают экшены входа, когда идти к провайдеру бессмысленно (он не
  // настроен) либо ответ провайдера не прошёл проверку.
  const unconfigured: Record<string, string> = {
    google: 'Google — AUTH_GOOGLE_ID и AUTH_GOOGLE_SECRET',
    yandex: 'Яндекс — AUTH_YANDEX_ID и AUTH_YANDEX_SECRET',
  };
  const missing = Object.keys(unconfigured).find((k) => sp[k as keyof typeof sp] === 'unconfigured');

  const notice = missing
    ? `Этот способ входа пока не настроен: ${unconfigured[missing]} (см. .env.example). После добавления перезапустите сервер.`
    : sp.telegram === 'failed'
      ? 'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз или войдите другим способом.'
      : undefined;

  return (
    <AuthForm
      action={loginAction}
      title="С возвращением"
      subtitle="Войдите, чтобы открыть свой песенник."
      telegram={<TelegramLoginButton />}
      submitLabel="Войти"
      notice={notice}
      footer={
        <>
          Нет аккаунта?{' '}
          <Link href="/register" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
            Зарегистрироваться
          </Link>
        </>
      }
    />
  );
}
