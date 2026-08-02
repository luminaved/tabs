import type { Metadata } from 'next';
import { CatalogView } from '@/components/CatalogView';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import { jsonLdScript } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'Аккорды песен на гитару — каталог разборов',
  description:
    'Каталог разборов: аккорды песен на гитару с текстом, аппликатурами и ' +
    'транспонированием. Ищите песню по названию или исполнителю.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    // siteName и locale приходится повторять на каждой странице со своим
    // openGraph: Next заменяет этот блок целиком, а не дополняет корневой, и
    // без них превью ссылки уходит в мессенджер без имени сайта.
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: 'Аккорды песен на гитару — каталог разборов',
    description: 'Разборы песен: аккорды над словами, аппликатуры, транспонирование.',
  },
};

/**
 * Название сайта для поисковика. Именно по разметке `WebSite` на ГЛАВНОЙ
 * Google решает, каким именем подписать сайт в выдаче — без неё он додумывает
 * его сам из домена и заголовков, что после переименования даёт разнобой.
 * Только здесь: на внутренних страницах эта разметка игнорируется.
 */
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  description: SITE_TAGLINE,
  url: SITE_URL,
  inLanguage: 'ru',
};

/** Каталог гитары — он же главная страница (адрес не менялся). */
export default function GuitarCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; verified?: string }>;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd) }}
      />
      <CatalogView instrument="guitar" searchParams={searchParams} />
    </>
  );
}
