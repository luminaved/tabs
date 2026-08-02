import { auth } from '@/lib/auth';
import { getPublicUser } from '@/lib/users';
import { MobileNav } from './MobileNav';

/**
 * Серверная обёртка нижней навигации: знает о сессии, саму панель рисует
 * клиентский компонент (ему нужен текущий путь и реакция на прокрутку).
 *
 * `getPublicUser` обёрнут в cache(), поэтому общий с шапкой запрос к БД
 * выполняется один раз на рендер страницы.
 */
export async function MobileNavBar() {
  const session = await auth();
  const me = session?.user?.id ? await getPublicUser(session.user.id) : null;

  return (
    <MobileNav
      authed={!!session?.user}
      name={me?.name ?? session?.user?.name ?? null}
      email={session?.user?.email ?? null}
      avatarVersion={me?.avatarVersion ?? null}
      userId={session?.user?.id ?? null}
    />
  );
}
