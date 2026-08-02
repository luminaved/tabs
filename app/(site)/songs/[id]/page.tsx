import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer } from '@/lib/songs';
import { listBySong } from '@/lib/annotations';
import { getSongEngagement, recordView, type ViewerRef } from '@/lib/engagement';
import { currentVisitorKey } from '@/lib/visitor';
import { parseChordDefs } from '@/lib/chords/diagrams';
import { getInstrument } from '@/lib/chords/instruments';
import { isAdminUser } from '@/lib/admin';
import { coverSrc } from '@/lib/coverUrl';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { jsonLdScript } from '@/lib/jsonLd';
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
  const inst = getInstrument(song.instrument);
  const title = artist
    ? `${song.title} — ${artist}: аккорды на ${inst.onName}`
    : `${song.title} — аккорды на ${inst.onName}`;

  const description = [
    `Разбор песни «${song.title}»${artist ? ` — ${artist}` : ''}: аккорды над словами,`,
    `аппликатуры для ${inst.forName} и транспонирование в любую тональность.`,
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
  const inst = getInstrument(song.instrument);

  const viewerId = session?.user?.id;

  // Кого считать за зрителя: вошедшего — по аккаунту, гостя — по суточному
  // отпечатку (боты отсеиваются там же). Свой разбор счётчик не накручивает,
  // поэтому у владельца зрителя нет. Отпечаток берётся из заголовков и в БД не
  // ходит, так что до общего Promise.all это не добавляет ожидания.
  const viewer: ViewerRef | null = viewerId
    ? isOwner
      ? null
      : { userId: viewerId }
    : await currentVisitorKey().then((key) => (key ? { visitorId: key } : null));

  // Просмотр засчитываем ПАРАЛЛЕЛЬНО с остальными запросами (последовательно
  // это добавляло бы к загрузке лишний round-trip до БД). Счётчик, прочитанный
  // одновременно, может не включать этот просмотр — поэтому прибавляем вручную.
  const [annotations, engagement, justViewed, canVerify] = await Promise.all([
    isOwner ? listBySong(song.id) : Promise.resolve([]),
    getSongEngagement(song.id, viewerId),
    viewer ? recordView(song.id, viewer) : Promise.resolve(false),
    isAdminUser(viewerId),
  ]);

  // Структурированные данные: помогают поисковику понять, что это разбор
  // конкретной песни конкретного исполнителя. Только для публичных.
  const jsonLd =
    song.visibility === 'public'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `${song.title}${song.artist ? ` — ${song.artist}` : ''}: аккорды на ${inst.onName}`,
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
    // Запас снизу: на телефоне меньше — там своё место занимает нижняя навигация.
    <main className="container-app pb-16 pt-8 sm:pb-28">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      ) : null}
      <SongViewer
        record={song}
        songId={song.id}
        coverUrl={song.hasCover ? coverSrc(song.id, song.updatedAt) : null}
        note={song.note}
        createdAt={song.createdAt}
        instrument={inst.id}
        verified={song.verified}
        canVerify={canVerify}
        chordDefs={parseChordDefs(song.chordDefs, inst)}
        engagement={{ ...engagement, viewCount: engagement.viewCount + (justViewed ? 1 : 0) }}
        editHref={isOwner ? `/songs/${song.id}/edit` : undefined}
        annotations={annotations}
        canAnnotate={isOwner}
        shareUrl={absoluteUrl(`/songs/${song.id}`)}
        shareTitle={`${song.title}${song.artist ? ` — ${song.artist}` : ''}: аккорды на ${inst.onName}`}
      />
    </main>
  );
}
