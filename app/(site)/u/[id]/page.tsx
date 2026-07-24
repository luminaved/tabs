import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicUser } from '@/lib/users';
import { listUserPublicSongs } from '@/lib/engagement';
import { Avatar } from '@/components/Avatar';
import { SongRow } from '@/components/SongRow';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getPublicUser(id);
  return {
    title: user ? `${user.name ?? 'Автор'} — tabs` : 'tabs',
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getPublicUser(id);
  if (!user) notFound();

  const songs = await listUserPublicSongs(id);

  return (
    <main className="container-app py-10">
      <section className="mb-8 flex items-center gap-4">
        <Avatar image={user.image} name={user.name} size={96} />
        <div className="min-w-0">
          <h1 className="display truncate text-3xl font-medium">{user.name || 'Автор'}</h1>
          <p className="text-muted">Публичных разборов: {songs.length}</p>
        </div>
      </section>

      {songs.length === 0 ? (
        <div className="card px-6 py-14 text-center text-muted">
          У автора пока нет публичных разборов.
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
