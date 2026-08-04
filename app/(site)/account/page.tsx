import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { getPublicUser, getUserProfile } from '@/lib/users';
import { getLibraryCounts, listFavoriteSongs, listLikedSongs } from '@/lib/engagement';
import { isAdminUser } from '@/lib/admin';
import { countOwnByInstrument } from '@/lib/songs';
import { SongRow } from '@/components/SongRow';
import { InstrumentIcon } from '@/components/InstrumentIcon';
import { ProfileEditor } from '@/components/ProfileEditor';

export const metadata: Metadata = {
  title: 'Личный кабинет',
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sessionUser = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === 'liked' ? 'liked' : 'favorites';

  const [profile, publicUser, counts, own, songs, isAdmin] = await Promise.all([
    getUserProfile(sessionUser.id),
    // Отпечаток аватара. Отдельным запросом это не выглядит, но им и не
    // является: шапка сайта спрашивает то же самое раньше, а `getPublicUser`
    // обёрнут в `cache()` — здесь возвращается уже посчитанный ответ.
    getPublicUser(sessionUser.id),
    getLibraryCounts(sessionUser.id),
    countOwnByInstrument(sessionUser.id),
    sp.tab === 'liked' ? listLikedSongs(sessionUser.id) : listFavoriteSongs(sessionUser.id),
    isAdminUser(sessionUser.id),
  ]);

  if (!profile) redirect('/login');

  const memberSince = profile.createdAt.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <main className="container-app py-10">
      <p className="eyebrow mb-4">Личный кабинет</p>

      <ProfileEditor
        userId={sessionUser.id}
        name={profile.name ?? ''}
        email={profile.email}
        avatarVersion={publicUser?.avatarVersion ?? null}
        memberSince={memberSince}
        actions={
          <>
            <Link
              href={`/u/${sessionUser.id}`}
              className="btn btn-outline h-11 gap-2.5 px-3.5 text-sm"
            >
              <UserIcon />
              Публичный профиль
            </Link>
            {/* Вход в статистику — только у администратора: обычному
                пользователю страница отдаёт 404, и ссылка вела бы в никуда. */}
            {isAdmin ? (
              <Link href="/admin" className="btn btn-outline h-11 gap-2.5 px-3.5 text-sm">
                <ChartIcon />
                Статистика
              </Link>
            ) : null}
          </>
        }
        exit={
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="btn btn-outline btn-exit h-11 gap-2.5 px-3.5 text-sm">
              <ExitIcon />
              Выйти
            </button>
          </form>
        }
      />

      {/* Библиотеки разделены по инструментам — как и публичный каталог.

          На телефоне это сетка в две колонки, а не `flex-wrap`: инструментов
          ровно два, они равнозначны и подписи у них короткие — рваный ряд
          получался на пустом месте. «Новая песня» занимает обе колонки: она
          другого рода (действие, а не переход) и не должна вставать в пару к
          одному из инструментов, как будто относится только к нему. */}
      <section className="mt-9">
        <h2 className="mb-3 text-lg font-medium">Мои разборы</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <Link href="/songs" className="btn btn-outline gap-2">
            <InstrumentIcon instrument="guitar" size={18} className="-me-0.5" />
            Гитара
            <span className="count-badge">{own.guitar}</span>
          </Link>
          <Link href="/songs/ukulele" className="btn btn-outline gap-2">
            <InstrumentIcon instrument="ukulele" size={19} className="-me-2" />
            Укулеле
            <span className="count-badge">{own.ukulele}</span>
          </Link>
          <Link href="/songs/new" className="btn btn-primary col-span-2 gap-2 sm:col-span-1">
            <PlusIcon />
            Новая песня
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Сохранённое</h2>
        <div className="mb-6 flex gap-2 border-b border-line">
          <TabLink active={tab === 'favorites'} href="/account?tab=favorites">
            Избранное <span className="count-badge ms-1.5">{counts.favorites}</span>
          </TabLink>
          <TabLink active={tab === 'liked'} href="/account?tab=liked">
            Лайкнутое <span className="count-badge ms-1.5">{counts.liked}</span>
          </TabLink>
        </div>

        {songs.length === 0 ? (
          <div className="card px-6 py-14 text-center text-muted">
            {tab === 'liked' ? 'Вы ещё ничего не лайкнули.' : 'В избранном пока пусто.'}
            <div className="mt-4">
              <Link href="/" className="text-accent underline-offset-4 hover:underline">
                Открыть каталог →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {songs.map((song) => (
              <li key={song.id}>
                <SongRow song={song} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={active ? 'tab tab--on' : 'tab'}>
      {children}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
