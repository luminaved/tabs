import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer } from '@/lib/songs';
import { listBySong } from '@/lib/annotations';
import { getSongEngagement, recordView } from '@/lib/engagement';
import { parseChordDefs } from '@/lib/chords/diagrams';
import { coverSrc } from '@/lib/coverUrl';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { SongViewer } from '@/components/SongViewer';

/**
 * Метаданные разбора. Заголовок собран под то, как люди ищут: «<песня>
 * аккорды на гитаре», плюс исполнитель. В индекс попадают ТОЛЬКО публичные
 * разборы — «по ссылке» и приватные остаются закрытыми от поисковиков.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(id, session?.user?.id);
  // notFound() именно здесь, а не только в самой странице: из-за скелетона
  // (loading.tsx) ответ стримится, и статус успевает уйти как 200 раньше, чем
  // отработает страница — получался soft-404. Метаданные считаются до стрима.
  if (!song) notFound();

  const artist = song.artist?.trim();
  const title = artist
    ? `${song.title} — ${artist}: аккорды на гитаре`
    : `${song.title} — аккорды на гитаре`;

  const description = [
    `Разбор песни «${song.title}»${artist ? ` — ${artist}` : ''}: аккорды над словами,`,
    'аппликатуры и транспонирование в любую тональность.',
    song.key ? `Тональность: ${song.key}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const url = `/songs/${song.id}`;
  const isPublic = song.visibility === 'public';

  return {
    title,
    description,
    alternates: { canonical: url },
    // Индексируем только публичные; unlisted живёт по ссылке, но не в поиске.
    robots: isPublic
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      images: [
        {
          url: `/songs/${song.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${song.title}${artist ? ` — ${artist}` : ''}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/songs/${song.id}/opengraph-image`],
    },
  };
}

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(id, session?.user?.id);
  if (!song) notFound();

  const isOwner = song.userId === session?.user?.id;

  // Просмотр засчитываем ПАРАЛЛЕЛЬНО с остальными запросами (последовательно
  // это добавляло бы к загрузке лишний round-trip до БД). Счётчик, прочитанный
  // одновременно, может не включать этот просмотр — поэтому прибавляем вручную.
  // Не чаще раза в 12 часов с аккаунта; свои разборы не накручивают счётчик.
  const viewerId = session?.user?.id;
  const [annotations, engagement, justViewed] = await Promise.all([
    isOwner ? listBySong(song.id) : Promise.resolve([]),
    getSongEngagement(song.id, viewerId),
    viewerId && !isOwner ? recordView(song.id, viewerId) : Promise.resolve(false),
  ]);

  // Структурированные данные: помогают поисковику понять, что это разбор
  // конкретной песни конкретного исполнителя. Только для публичных.
  const jsonLd =
    song.visibility === 'public'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `${song.title}${song.artist ? ` — ${song.artist}` : ''}: аккорды на гитаре`,
          about: {
            '@type': 'MusicComposition',
            name: song.title,
            ...(song.artist ? { composer: { '@type': 'Person', name: song.artist } } : {}),
            ...(song.key ? { musicalKey: song.key } : {}),
          },
          datePublished: song.createdAt.toISOString(),
          dateModified: song.updatedAt.toISOString(),
          inLanguage: 'ru',
          mainEntityOfPage: absoluteUrl(`/songs/${song.id}`),
          ...(song.hasCover ? { image: absoluteUrl(coverSrc(song.id, song.updatedAt)) } : {}),
        }
      : null;

  return (
    <main className="container-app pb-28 pt-8">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <SongViewer
        record={song}
        songId={song.id}
        coverUrl={song.hasCover ? coverSrc(song.id, song.updatedAt) : null}
        note={song.note}
        createdAt={song.createdAt}
        chordDefs={parseChordDefs(song.chordDefs)}
        engagement={{ ...engagement, viewCount: engagement.viewCount + (justViewed ? 1 : 0) }}
        editHref={isOwner ? `/songs/${song.id}/edit` : undefined}
        annotations={annotations}
        canAnnotate={isOwner}
        shareUrl={absoluteUrl(`/songs/${song.id}`)}
        shareTitle={`${song.title}${song.artist ? ` — ${song.artist}` : ''}: аккорды на гитаре`}
      />
    </main>
  );
}
