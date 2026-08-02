import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
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
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  const notice =
    sp.google === 'unconfigured'
      ? 'Вход через Google пока не настроен. Добавьте AUTH_GOOGLE_ID и AUTH_GOOGLE_SECRET (см. .env.example), затем перезапустите dev-сервер.'
      : undefined;

  return (
    <AuthForm
      action={loginAction}
      title="С возвращением"
      subtitle="Войдите, чтобы открыть свой песенник."
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
