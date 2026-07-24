import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { loginAction } from '../actions';

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
