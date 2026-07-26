import type { Metadata } from 'next';
import { CatalogView } from '@/components/CatalogView';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Аккорды песен на укулеле — каталог разборов',
  description:
    'Каталог разборов для укулеле: аккорды песен с текстом, аппликатурами под ' +
    'строй GCEA и транспонированием. Ищите песню по названию или исполнителю.',
  alternates: { canonical: '/ukulele' },
  openGraph: {
    type: 'website',
    url: '/ukulele',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: 'Аккорды песен на укулеле — каталог разборов',
    description: 'Разборы для укулеле: аккорды над словами, аппликатуры GCEA, транспонирование.',
  },
};

export default function UkuleleCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; verified?: string }>;
}) {
  return <CatalogView instrument="ukulele" searchParams={searchParams} />;
}
