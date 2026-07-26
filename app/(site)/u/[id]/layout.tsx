import { notFound } from 'next/navigation';
import { getPublicUser } from '@/lib/users';

/**
 * Гейт существования автора — в layout, а не в page: собственный loading.tsx
 * сегмента оборачивает в Suspense страницу, но не этот layout, поэтому
 * notFound() успевает отдать честный 404 до начала стриминга.
 * getPublicUser обёрнут в cache(), так что лишнего запроса нет.
 */
export default async function AuthorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getPublicUser(id);
  if (!user) notFound();

  return <>{children}</>;
}
