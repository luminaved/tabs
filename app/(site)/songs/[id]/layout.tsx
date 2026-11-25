import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer } from '@/lib/songs';
import { songIdFromParam } from '@/lib/slug';

/**
 * Гейт существования/видимости разбора.
 *
 * Проверка живёт именно в layout, а не только в page: собственный loading.tsx
 * сегмента оборачивает в Suspense его страницу, но НЕ этот layout. Значит
 * layout успевает отработать до начала стриминга — и notFound() отдаёт честный
 * 404, а не «200 + страница не найдена» (soft-404, за который штрафует поиск).
 * Запрос не лишний: getSongForViewer обёрнут в cache() и переиспользуется
 * страницей и generateMetadata.
 *
 * Сегмент адреса — «подпись-идентификатор» (см. [lib/slug.ts](../../../../lib/slug.ts)),
 * поэтому ключ достаётся из него, а не берётся целиком.
 */
export default async function SongLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(songIdFromParam(id), session?.user?.id);
  if (!song) notFound();

  return <>{children}</>;
}
