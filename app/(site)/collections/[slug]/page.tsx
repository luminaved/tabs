import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  COLLECTIONS,
  countCollection,
  findCollection,
  listCollectionSongs,
} from '@/lib/collections';
import { SITE_NAME } from '@/lib/site';
import { breadcrumbJsonLd, itemListJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { songPath } from '@/lib/slug';
import { SongRow } from '@/components/SongRow';
import { EAGER_THUMBS } from '@/components/SongThumb';
import { Breadcrumbs } from '@/components/Breadcrumbs';

/** Подборки заданы списком, поэтому адреса раздела известны заранее. */
export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = findCollection(slug);
  if (!collection) notFound();

  // Число берём отдельным счётом, а не длиной показанного списка: список
  // ограничен потолком, и описание в выдаче обещало бы меньше, чем есть.
  const count = await countCollection(collection);
  const title = `${collection.title} — аккорды и разборы`;
  const description = collection.description(count);

  return {
    title,
    description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      type: 'website',
      url: `/collections/${collection.slug}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title,
      description,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = findCollection(slug);
  if (!collection) notFound();

  const songs = await listCollectionSongs(collection);
  const crumbs: Crumb[] = [
    { name: 'Подборки', path: '/collections' },
    { name: collection.title, path: `/collections/${collection.slug}` },
  ];

  return (
    <main className="container-app py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }}
      />
      {songs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              itemListJsonLd(
                songs.map((s) => ({
                  name: `${s.title}${s.artist ? ` — ${s.artist}` : ''}`,
                  path: songPath(s),
                })),
                collection.title,
              ),
            ),
          }}
        />
      ) : null}

      <Breadcrumbs crumbs={crumbs} />

      <header className="mb-8">
        <p className="eyebrow mb-2">Подборка</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">{collection.title}</h1>
        <p className="mt-2 max-w-2xl text-muted">{collection.intro}</p>
      </header>

      {songs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {songs.map((song, i) => (
            <li key={song.id}>
              <SongRow song={song} priority={i < EAGER_THUMBS} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card px-6 py-14 text-center text-muted">
          В этой подборке пока нет разборов.
        </div>
      )}

      <p className="mt-8 text-sm text-muted">
        <Link href="/collections" className="hover:text-fg hover:underline">
          ← Все подборки
        </Link>
      </p>
    </main>
  );
}
