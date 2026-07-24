import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { registerAction } from '../actions';

export default function RegisterPage() {
  return (
    <AuthForm
      action={registerAction}
      title="Свой песенник"
      subtitle="Создайте аккаунт — это займёт минуту."
      submitLabel="Создать аккаунт"
      withName
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
            Войти
          </Link>
        </>
      }
    />
  );
}
