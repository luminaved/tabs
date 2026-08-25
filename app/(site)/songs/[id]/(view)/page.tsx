import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer, listRelatedSongs } from '@/lib/songs';
import { listBySong } from '@/lib/annotations';
import { getSongEngagement, recordView, type ViewerRef } from '@/lib/engagement';
import { currentVisitorKey } from '@/lib/visitor';
import { getPublicUser } from '@/lib/users';
import { parseChordDefs } from '@/lib/chords/diagrams';
import { catalogPath, getInstrument } from '@/lib/chords/instruments';
import { isAdminUser } from '@/lib/admin';
import { coverSrc } from '@/lib/coverUrl';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { jsonLdScript } from '@/lib/jsonLd';
import { publisherJsonLd, songSeoDescription, songSeoTitle, type Crumb } from '@/lib/seo';
import { songIdFromParam, songPath } from '@/lib/slug';
import { resolveSongKey } from '@/lib/chordpro/fromRecord';
import { SongViewer } from '@/components/SongViewer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedSongs } from '@/components/RelatedSongs';
import { CopyrightNotice } from '@/components/CopyrightNotice';

/**
 * Метаданные разбора. Заголовок и описание собраны под то, как люди ищут —
 * формулы вынесены в [lib/seo.ts](../../../../../lib/seo.ts), потому что теми же
 * строками подписывается ссылка при «Поделиться».
 *
 * В индекс попадают ТОЛЬКО публичные разборы — «по ссылке» и приватные
 * остаются закрытыми от поисковиков.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(songIdFromParam(id), session?.user?.id);
  // notFound() именно здесь, а не только в самой странице: из-за скелетона
  // (loading.tsx) ответ стримится, и статус успевает уйти как 200 раньше, чем
  // отработает страница — получался soft-404. Метаданные считаются до стрима.
  if (!song) notFound();

  const artist = song.artist?.trim();
  const inst = getInstrument(song.instrument);
  const title = songSeoTitle(song, inst);
  // Тональность может быть выведена из аккордов: в базе она не заполнена ни у
  // одной песни, а описание в выдаче её обещает (см. resolveSongKey).
  const description = songSeoDescription({ ...song, key: resolveSongKey(song) }, inst);

  // Канонический адрес — с подписью. Пришедшего по голому `/songs/<id>` сюда
  // не пустит редирект из layout'а, но canonical всё равно ставим от него же:
  // одна формула на весь сайт, разъехаться нечему.
  const url = songPath(song);
  // Картинка превью живёт под голым идентификатором: подпись ей не нужна, а
  // адрес без неё не меняется при переименовании и остаётся в кэше мессенджера.
  const image = `/songs/${song.id}/opengraph-image`;
  const isPublic = song.visibility === 'public';

  return {
    title,
    description,
    alternates: { canonical: url },
    // Индексируем только публичные; unlisted живёт по ссылке, но не в поиске.
    robots: isPublic
      ? {
          index: true,
          follow: true,
          // Разрешаем показывать в выдаче длинный отрывок и большое превью:
          // по умолчанию Google берёт короткий сниппет, а разбору есть что
          // показать (первые строки с аккордами) — это заметно на кликах.
          googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
        }
      : { index: false, follow: false },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      publishedTime: song.createdAt.toISOString(),
      modifiedTime: song.updatedAt.toISOString(),
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${song.title}${artist ? ` — ${artist}` : ''}`,
        },
      ],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(songIdFromParam(id), session?.user?.id);
  if (!song) notFound();

  const isOwner = song.userId === session?.user?.id;
  const inst = getInstrument(song.instrument);
  // Та же тональность, что уходит в описание выдачи (см. generateMetadata).
  const songKey = resolveSongKey(song);

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

  const isPublic = song.visibility === 'public';

  // Просмотр засчитываем ПАРАЛЛЕЛЬНО с остальными запросами (последовательно
  // это добавляло бы к загрузке лишний round-trip до БД). Счётчик, прочитанный
  // одновременно, может не включать этот просмотр — поэтому прибавляем вручную.
  const [annotations, engagement, justViewed, canVerify, related, author] = await Promise.all([
    isOwner ? listBySong(song.id) : Promise.resolve([]),
    getSongEngagement(song.id, viewerId),
    viewer ? recordView(song.id, viewer) : Promise.resolve(false),
    isAdminUser(viewerId),
    // Соседей ищем только у публичных: у приватного разбора блок «похожие»
    // сводился бы к рекламе чужих песен на собственной закрытой странице.
    isPublic ? listRelatedSongs(song) : Promise.resolve([]),
    // Автор разбора — для структурированных данных: без `author` разметка
    // Article у Google невалидна, и он выбрасывает её целиком. Запрос лёгкий
    // (одна строка) и идёт здесь же, в общей пачке, чтобы не добавлять
    // round-trip; у приватного разбора разметки нет — спрашивать незачем.
    isPublic ? getPublicUser(song.userId) : Promise.resolve(null),
  ]);

  const url = songPath(song);
  const viewCount = engagement.viewCount + (justViewed ? 1 : 0);

  // Путь до страницы: каталог своего инструмента → исполнитель → разбор.
  // Исполнителя пропускаем, когда его нет: крошка в никуда хуже её отсутствия.
  const crumbs: Crumb[] = [
    { name: `Аккорды для ${inst.forName}`, path: catalogPath(inst.id) },
    ...(song.artist
      ? [{ name: song.artist, path: `/artist/${encodeURIComponent(song.artist)}` }]
      : []),
    { name: song.title, path: url },
  ];

  // Структурированные данные: помогают поисковику понять, что это разбор
  // конкретной песни конкретного исполнителя. Только для публичных.
  const jsonLd = isPublic
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: songSeoTitle(song, inst),
        description: songSeoDescription(song, inst),
        about: {
          '@type': 'MusicComposition',
          name: song.title,
          ...(song.artist ? { composer: { '@type': 'Person', name: song.artist } } : {}),
          ...(songKey ? { musicalKey: songKey } : {}),
        },
        datePublished: song.createdAt.toISOString(),
        dateModified: song.updatedAt.toISOString(),
        inLanguage: 'ru',
        // Разбор делает человек, и Google просит сказать, какой именно: без
        // `author` он считает Article неполной. У автора без имени ссылаться
        // не на кого — тогда автором значится сам сайт, как у любой редакции.
        author:
          author?.name
            ? { '@type': 'Person', name: author.name, url: absoluteUrl(`/u/${song.userId}`) }
            : publisherJsonLd,
        // Разбор открыт целиком и без регистрации — для поисковика это отдельный
        // факт: страницы с частично скрытым текстом он ранжирует иначе.
        isAccessibleForFree: true,
        publisher: publisherJsonLd,
        mainEntityOfPage: absoluteUrl(url),
        // Счётчики берём настоящие. Разметка «оценок» здесь принципиально не
        // ставится: звёзд на сайте нет, а выдуманный рейтинг — прямой путь к
        // ручным санкциям.
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/ViewAction',
            userInteractionCount: viewCount,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: engagement.likeCount,
          },
        ],
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
      {/* Крошки только у публичных: у приватного разбора это лишний ряд ссылок
          на странице, которую всё равно видит один человек. */}
      {isPublic ? <Breadcrumbs crumbs={crumbs} /> : null}
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
        engagement={{ ...engagement, viewCount }}
        editHref={isOwner ? `${url}/edit` : undefined}
        annotations={annotations}
        canAnnotate={isOwner}
        shareUrl={absoluteUrl(url)}
        shareTitle={songSeoTitle(song, inst)}
      />
      <RelatedSongs songs={related} artist={song.artist} instrument={inst} />
      {/* Приватный разбор видит один человек — его автор, и предлагать ему
          пожаловаться на самого себя незачем. */}
      {song.visibility !== 'private' ? <CopyrightNotice pageUrl={absoluteUrl(url)} /> : null}
    </main>
  );
}
