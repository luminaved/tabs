import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { signOut } from '@/lib/auth';
import { getUserProfile } from '@/lib/users';
import { getLibraryCounts, listFavoriteSongs, listLikedSongs } from '@/lib/engagement';
import { countOwnByInstrument } from '@/lib/songs';
import { SongRow } from '@/components/SongRow';
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

  const [profile, counts, own, songs] = await Promise.all([
    getUserProfile(sessionUser.id),
    getLibraryCounts(sessionUser.id),
    countOwnByInstrument(sessionUser.id),
    sp.tab === 'liked' ? listLikedSongs(sessionUser.id) : listFavoriteSongs(sessionUser.id),
  ]);

  if (!profile) redirect('/login');

  const memberSince = profile.createdAt.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <main className="container-app py-10">
      <section className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">Личный кабинет</p>
          <div className="flex items-center gap-2">
            <Link href={`/u/${sessionUser.id}`} className="btn btn-ghost h-9 px-3 text-sm">
              Публичный профиль
            </Link>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button type="submit" className="btn btn-ghost h-9 px-3 text-sm">
                Выйти
              </button>
            </form>
          </div>
        </div>

        <ProfileEditor
          name={profile.name ?? ''}
          email={profile.email}
          image={profile.image}
          memberSince={memberSince}
        />

        {/* Библиотеки разделены по инструментам — как и публичный каталог */}
        <div className="flex flex-wrap gap-3">
          <Link href="/songs" className="btn btn-outline">
            Гитара ({own.guitar})
          </Link>
          <Link href="/songs/ukulele" className="btn btn-outline">
            Укулеле ({own.ukulele})
          </Link>
          <Link href="/songs/new" className="btn btn-primary">
            + Новая песня
          </Link>
        </div>
      </section>

      <div className="mb-6 flex gap-2 border-b border-line">
        <TabLink active={tab === 'favorites'} href="/account?tab=favorites">
          Избранное ({counts.favorites})
        </TabLink>
        <TabLink active={tab === 'liked'} href="/account?tab=liked">
          Лайкнутое ({counts.liked})
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
