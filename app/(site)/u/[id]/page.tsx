import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicUser } from '@/lib/users';
import { countUserPublicByInstrument, listUserPublicSongs } from '@/lib/engagement';
import {
  INSTRUMENTS,
  INSTRUMENT_IDS,
  parseInstrumentId,
  type InstrumentId,
} from '@/lib/chords/instruments';
import { SITE_NAME } from '@/lib/site';
import { Avatar } from '@/components/Avatar';
import { SongRow } from '@/components/SongRow';
import { LoadMoreSongs } from '@/components/LoadMoreSongs';
import { loadMoreUserSongsAction } from './actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getPublicUser(id);
  if (!user) notFound(); // до стриминга — иначе ушёл бы soft-404 (см. песню)

  const name = user.name ?? 'Автор';
  return {
    title: `${name} — разборы песен и аккорды`,
    description: `Разборы песен от ${name}: аккорды для гитары и укулеле с текстом и аппликатурами.`,
    // Разделение по инструментам и поиск — параметры запроса, а не отдельные
    // адреса: спроса на «автор X укулеле» в поиске нет, а плодить тонкие
    // индексируемые страницы ради фильтра не нужно. Canonical всегда базовый.
    alternates: { canonical: `/u/${id}` },
    openGraph: {
      type: 'profile',
      url: `/u/${id}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title: `${name} — разборы песен и аккорды`,
      description: `Разборы песен от ${name}: аккорды для гитары и укулеле.`,
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ instrument?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const instrument = sp.instrument ? parseInstrumentId(sp.instrument) : undefined;

  // Параллельно: запросы независимы, последовательно это лишний round-trip.
  const [user, { songs, hasMore }, counts] = await Promise.all([
    getPublicUser(id),
    listUserPublicSongs(id, { instrument, query }),
    countUserPublicByInstrument(id),
  ]);
  if (!user) notFound();

  const total = counts.guitar + counts.ukulele;
  // Вкладки нужны только если делить действительно есть что.
  const withSongs = INSTRUMENT_IDS.filter((i) => counts[i] > 0);
  const showTabs = withSongs.length > 1;

  const href = (inst?: InstrumentId) => {
    const p = new URLSearchParams();
    if (inst) p.set('instrument', inst);
    if (query) p.set('q', query);
    const qs = p.toString();
    return qs ? `/u/${id}?${qs}` : `/u/${id}`;
  };

  return (
    <main className="container-app py-10">
      <section className="mb-8 flex items-center gap-4">
        <Avatar image={user.image} name={user.name} size={96} userId={id} />
        <div className="min-w-0">
          <h1 className="display truncate text-3xl font-medium">{user.name || 'Автор'}</h1>
          <p className="text-muted">Публичных разборов: {total}</p>
        </div>
      </section>

      {total > 0 ? (
        <div className="mb-8 flex flex-col gap-3">
          {showTabs ? (
            <div className="inst-tabs" role="group" aria-label="Инструмент">
              <Link
                href={href()}
                className={!instrument ? 'inst-tab inst-tab--on' : 'inst-tab'}
                aria-current={!instrument ? 'true' : undefined}
              >
                Все<span className="inst-tab-count">{total}</span>
              </Link>
              {withSongs.map((i) => (
                <Link
                  key={i}
                  href={href(i)}
                  className={instrument === i ? 'inst-tab inst-tab--on' : 'inst-tab'}
                  aria-current={instrument === i ? 'true' : undefined}
                >
                  {INSTRUMENTS[i].name}
                  <span className="inst-tab-count">{counts[i]}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <form className="flex gap-2" method="get">
            <input
              name="q"
              defaultValue={query ?? ''}
              placeholder="Поиск по разборам автора"
              className="field flex-1"
              autoComplete="off"
            />
            {/* Выбранный инструмент переживает поиск */}
            {instrument ? <input type="hidden" name="instrument" value={instrument} /> : null}
            <button type="submit" className="btn btn-outline">
              Найти
            </button>
          </form>
        </div>
      ) : null}

      {songs.length === 0 ? (
        <div className="card px-6 py-14 text-center text-muted">
          {total === 0
            ? 'У автора пока нет публичных разборов.'
            : query
              ? 'Ничего не найдено.'
              : `Нет разборов для ${INSTRUMENTS[instrument ?? 'guitar'].forName}.`}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li key={song.id}>
              <SongRow song={song} />
            </li>
          ))}
          {/* key: смена вкладки инструмента или поиска сбрасывает подгруженное */}
          <LoadMoreSongs
            key={`${instrument ?? 'all'}:${query ?? ''}`}
            loadMore={loadMoreUserSongsAction.bind(null, { userId: id, query, instrument })}
            hasMore={hasMore}
          />
        </ul>
      )}
    </main>
  );
}
