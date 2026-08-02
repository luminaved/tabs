import type { Metadata } from 'next';
import { CatalogView } from '@/components/CatalogView';
import { INSTRUMENTS, catalogPath } from '@/lib/chords/instruments';
import { catalogMetadata, websiteJsonLd } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';

/** Параметры отбора каталога — общие для обеих точек входа. */
type CatalogSearchParams = { q?: string; sort?: string; verified?: string };

/**
 * Метаданные считаются на запрос, а не заданы константой, потому что от
 * параметров зависит `robots`: каталог с поиском или отбором в индекс не идёт
 * (разбор — в [lib/seo.ts](../../../lib/seo.ts)).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  return catalogMetadata(INSTRUMENTS.guitar, catalogPath('guitar'), await searchParams);
}

/** Каталог гитары — он же главная страница (адрес не менялся). */
export default function GuitarCatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return (
    <>
      {/*
        Название сайта для поисковика и строка поиска в выдаче. Именно по
        разметке `WebSite` на ГЛАВНОЙ Google решает, каким именем подписать сайт
        — без неё он додумывает его сам из домена и заголовков, что после
        переименования даёт разнобой. Только здесь: на внутренних страницах эта
        разметка игнорируется.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }}
      />
      <CatalogView instrument="guitar" searchParams={searchParams} />
    </>
  );
}
