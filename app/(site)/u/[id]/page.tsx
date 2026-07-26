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
  if (!user) notFound(); // до стриминга — иначе ушёл бы soft-404 (см. песню)

  const name = user.name ?? 'Автор';
  return {
    title: `${name} — разборы песен и аккорды`,
    description: `Разборы песен от ${name}: аккорды на гитару с текстом и аппликатурами.`,
    alternates: { canonical: `/u/${id}` },
    openGraph: {
      type: 'profile',
      url: `/u/${id}`,
      title: `${name} — разборы песен и аккорды`,
      description: `Разборы песен от ${name}: аккорды на гитару.`,
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Параллельно: запросы независимы, последовательно это лишний round-trip.
  const [user, songs] = await Promise.all([getPublicUser(id), listUserPublicSongs(id)]);
  if (!user) notFound();

  return (
    <main className="container-app py-10">
      <section className="mb-8 flex items-center gap-4">
        <Avatar image={user.image} name={user.name} size={96} userId={id} />
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
