'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';

/**
 * Нижняя навигация для телефона: до неё дотягивается большой палец, тогда как
 * шапка на такой высоте требует перехвата телефона. На ширине от `sm` скрыта —
 * там работает обычная шапка.
 *
 * При прокрутке вниз панель уезжает за край и возвращается при движении вверх:
 * во время чтения песни (и автоскролла) экран остаётся целиком под текстом.
 */
export function MobileNav({
  authed,
  name,
  email,
  avatarVersion,
  userId,
}: {
  authed: boolean;
  name?: string | null;
  email?: string | null;
  /** Отпечаток аватара, а не сама картинка: base64 в разметку не попадает. */
  avatarVersion?: string | null;
  userId?: string | null;
}) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let queued = false;

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = window.scrollY;
        const delta = y - last;
        // Порог в несколько пикселей гасит дрожание и «резинку» на iOS.
        if (Math.abs(delta) < 8) return;
        setHidden(delta > 0 && y > 120);
        last = y;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Панель всегда видна на экранах, где её только что открыли переходом.
  useEffect(() => setHidden(false), [pathname]);

  return (
    <nav
      className={hidden ? 'mnav mnav--down print-hide' : 'mnav print-hide'}
      aria-label="Основная навигация"
    >
      <div className="mnav-inner">
        <NavItem href="/" label="Каталог" active={pathname === '/'}>
          <SearchIcon />
        </NavItem>

        {authed ? (
          <>
            {/* Обе свои библиотеки лежат под /songs — пункт активен для любой */}
            <NavItem
              href="/songs"
              label="Мои"
              active={pathname === '/songs' || pathname === '/songs/ukulele'}
            >
              <LibraryIcon />
            </NavItem>

            {/* Главное действие — по центру, акцентной кнопкой */}
            <Link
              href="/songs/new"
              className={
                pathname === '/songs/new' ? 'mnav-item mnav-item--on' : 'mnav-item'
              }
              aria-current={pathname === '/songs/new' ? 'page' : undefined}
            >
              <span className="mnav-icon">
                <span className="mnav-fab">
                  <PlusIcon />
                </span>
              </span>
              <span className="mnav-label">Новая</span>
            </Link>

            <NavItem href="/account" label="Кабинет" active={pathname.startsWith('/account')}>
              <span className="mnav-avatar">
                <Avatar version={avatarVersion} name={name} email={email} size={22} userId={userId} />
              </span>
            </NavItem>
          </>
        ) : (
          <NavItem href="/login" label="Войти" active={pathname.startsWith('/login')}>
            <UserIcon />
          </NavItem>
        )}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={active ? 'mnav-item mnav-item--on' : 'mnav-item'}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mnav-glow" aria-hidden />
      <span className="mnav-icon">{children}</span>
      <span className="mnav-label">{label}</span>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
