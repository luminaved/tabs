import type { Metadata } from 'next';
import { LibraryView } from '@/components/LibraryView';

export const metadata: Metadata = {
  title: 'Мои песни для укулеле',
  robots: { index: false, follow: false },
};

/**
 * Своя библиотека разборов для укулеле.
 *
 * Сегмент статический, поэтому Next разрешает его раньше динамического
 * `songs/[id]`; id разборов — cuid, так что песни по адресу `/songs/ukulele`
 * существовать не может и коллизии нет.
 */
export default function UkuleleLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <LibraryView instrument="ukulele" searchParams={searchParams} />;
}
