import type { Metadata } from 'next';
import Link from 'next/link';
import { listCatalogChords } from '@/lib/chords/chordPages';
import { SITE_NAME } from '@/lib/site';
import { breadcrumbJsonLd, itemListJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { withPluralRu } from '@/lib/plural';
import { Breadcrumbs } from '@/components/Breadcrumbs';

/**
 * Указатель справочника аккордов.
 *
 * Кроме собственных запросов («аккорды для гитары список», «все аккорды схемы»)
 * у страницы есть работа поважнее: она собирает раздел в одно место и раздаёт
 * вес на страницы аккордов. Без неё каждая из них висела бы отдельно, а
 * единственной ссылкой на неё была бы строка в разборе.
 */

const TITLE = 'Аккорды для гитары и укулеле — схемы и аппликатуры';
const DESCRIPTION =
  'Справочник аккордов: как ставить, схема аппликатуры для гитары и укулеле, ' +
  'позиция на грифе и живые разборы песен с этим аккордом. Отдельно — квинты ' +
  '(пауэр-аккорды) и их запись ладом и струной из русских табов.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/chords' },
  openGraph: {
    type: 'website',
    url: '/chords',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function ChordsIndexPage() {
  const chords = await listCatalogChords();
  // Квинты отдельным блоком: у них своя запись, свои запросы и свой читатель.
  const power = chords.filter((c) => c.power);
  const plain = chords.filter((c) => !c.power);

  const crumbs: Crumb[] = [{ name: 'Аккорды', path: '/chords' }];

  return (
    <main className="container-app py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }}
      />
      {chords.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              itemListJsonLd(
                chords.map((c) => ({ name: `Аккорд ${c.name}`, path: `/chords/${c.slug}` })),
                'Аккорды каталога',
              ),
            ),
          }}
        />
      ) : null}

      <Breadcrumbs crumbs={crumbs} />

      <header className="mb-8">
        <p className="eyebrow mb-2">Справочник</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">Аккорды</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Все аккорды, которые встречаются в разборах каталога. У каждого — схема для гитары и
          для укулеле, позиция на грифе и песни, где он звучит. Список растёт вместе с каталогом:
          аккордов, которых нет ни в одном разборе, здесь нет.
        </p>
      </header>

      {power.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-medium">Квинты</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Они же пауэр-аккорды: только корень и квинта, без терции — поэтому у них нет ни
            мажора, ни минора. В русских табах их часто пишут ладом и струной («6В» вместо
            «A#5»); на странице аккорда есть и такая подпись.
          </p>
          <ChordGrid items={power} />
        </section>
      ) : null}

      {plain.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-medium">Остальные</h2>
          <ChordGrid items={plain} />
        </section>
      ) : null}
    </main>
  );
}

function ChordGrid({
  items,
}: {
  items: { name: string; slug: string; count: number }[];
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
      {items.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/chords/${c.slug}`}
            className="card flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:border-accent"
            title={`Аккорд ${c.name}: аппликатуры и песни`}
          >
            <span className="display text-lg font-medium">{c.name}</span>
            <span className="text-xs text-faint">
              {withPluralRu(c.count, 'разбор', 'разбора', 'разборов')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
