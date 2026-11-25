import type { Metadata } from 'next';
import { CatalogView } from '@/components/CatalogView';
import { INSTRUMENTS, catalogPath } from '@/lib/chords/instruments';
import { catalogMetadata } from '@/lib/seo';

type CatalogSearchParams = { q?: string; sort?: string; verified?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  return catalogMetadata(INSTRUMENTS.ukulele, catalogPath('ukulele'), await searchParams);
}

export default function UkuleleCatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return <CatalogView instrument="ukulele" searchParams={searchParams} />;
}
