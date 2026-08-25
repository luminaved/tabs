import type { Metadata } from 'next';
import Link from 'next/link';
import { COLLECTIONS, countCollection } from '@/lib/collections';
import { SITE_NAME } from '@/lib/site';
import { breadcrumbJsonLd, itemListJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { withPluralRu } from '@/lib/plural';
import { Breadcrumbs } from '@/components/Breadcrumbs';

const TITLE = 'Подборки песен — простые аккорды и разборы для начинающих';
const DESCRIPTION =
  'Разборы, собранные по тому, насколько их сложно играть: песни на 3 и 4 аккорда ' +
  'для начинающих и песни целиком на квинтах. С текстом, схемами аппликатур и ' +
  'транспонированием под голос.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/collections' },
  openGraph: {
    type: 'website',
    url: '/collections',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function CollectionsIndexPage() {
  const counts = await Promise.all(COLLECTIONS.map((c) => countCollection(c)));
  const crumbs: Crumb[] = [{ name: 'Подборки', path: '/collections' }];

  return (
    <main className="container-app py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            itemListJsonLd(
              COLLECTIONS.map((c) => ({ name: c.title, path: `/collections/${c.slug}` })),
              'Подборки разборов',
            ),
          ),
        }}
      />

      <Breadcrumbs crumbs={crumbs} />

      <header className="mb-8">
        <p className="eyebrow mb-2">Подборки</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">С чего начать</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Разборы, сгруппированные по тому, сколько форм нужно выучить, чтобы сыграть песню
          целиком. Считается по самим разборам, а не проставляется руками.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {COLLECTIONS.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/collections/${c.slug}`}
              className="card flex flex-col gap-1 px-5 py-4 transition-colors hover:border-accent"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="display text-xl font-medium">{c.title}</span>
                <span className="text-sm text-faint">
                  {withPluralRu(counts[i], 'разбор', 'разбора', 'разборов')}
                </span>
              </span>
              <span className="text-sm text-muted">{c.intro}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
