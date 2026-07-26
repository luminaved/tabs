import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getPublicUser } from '@/lib/users';
import { Avatar } from './Avatar';

export async function SiteHeader() {
  const session = await auth();
  // Свежие имя/аватар из БД: JWT-сессия не обновляется после смены профиля.
  const me = session?.user?.id ? await getPublicUser(session.user.id) : null;
  const displayName = me?.name ?? session?.user?.name ?? null;

  return (
    <header className="site-header site-header--bordered">
      <div className="container-app flex h-14 items-center justify-between gap-3">
        <Link href="/" className="wordmark">
          tabs<span className="wordmark-dot">.</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className="nav-link">
            <SearchIcon />
            <span>Поиск</span>
          </Link>

          {session?.user ? (
            <>
              <Link href="/songs" className="nav-link">
                <LibraryIcon />
                <span className="hidden sm:inline">Мои песни</span>
              </Link>
              <Link href="/account" className="nav-link" title="Личный кабинет">
                <Avatar
                  image={me?.image}
                  name={displayName}
                  email={session.user.email}
                  size={24}
                  userId={session.user.id}
                />
                <span className="hidden max-w-[9rem] truncate md:inline">
                  {displayName ?? session.user.email}
                </span>
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary h-9 px-4 text-sm">
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
