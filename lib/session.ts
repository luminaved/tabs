import { redirect } from 'next/navigation';
import { auth } from './auth';

/** Требует авторизации в серверных компонентах/экшенах. Иначе — на /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user;
}
