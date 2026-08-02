import { notFound } from 'next/navigation';
import { findArtistName } from '@/lib/songs';

/**
 * Гейт существования исполнителя.
 *
 * Стоит в layout, а не в page, ровно по той же причине, что у разбора и автора:
 * собственный `loading.tsx` сегмента оборачивает в Suspense страницу, но НЕ
 * этот layout. Значит проверка успевает отработать до начала стриминга, и на
 * несуществующего исполнителя уходит честный 404, а не «200 + страница не
 * найдена» (soft-404, за который поиск штрафует).
 *
 * До появления скелетона проверка жила только в page и работала — стримить было
 * нечего. Скелетон это ломает, поэтому гейт и скелетон обязаны появляться
 * ПАРОЙ; порознь любой из них бесполезен или вреден.
 *
 * `findArtistName` обёрнут в cache(), поэтому страница и generateMetadata
 * переиспользуют этот же запрос, а не делают свой.
 */
export default async function ArtistLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // Битая процентная последовательность — берём сегмент как есть, ниже он
    // всё равно не найдётся.
  }

  if (!(await findArtistName(decoded))) notFound();

  return <>{children}</>;
}
