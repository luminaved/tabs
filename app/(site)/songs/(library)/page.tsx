import type { Metadata } from 'next';
import { LibraryView } from '@/components/LibraryView';

export const metadata: Metadata = {
  title: 'Мои песни для гитары',
  robots: { index: false, follow: false },
};

/** Своя библиотека гитарных разборов (адрес не менялся). */
export default function GuitarLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <LibraryView instrument="guitar" searchParams={searchParams} />;
}
