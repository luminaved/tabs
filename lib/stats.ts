import { prisma } from './db';
import { parseInstrumentId, type InstrumentId } from './chords/instruments';

/**
 * Сводка по сайту для админской страницы.
 *
 * Все запросы уходят одной пачкой: их два десятка, но это счётчики по
 * индексированным колонкам, а страницу открывает один человек и нечасто.
 * Последовательно те же запросы дали бы двадцать round-trip'ов до Neon.
 */

const DAY = 24 * 60 * 60 * 1000;
const since = (days: number) => new Date(Date.now() - days * DAY);

/** Глубина графиков по дням. */
export const TREND_DAYS = 30;

/** Точка дневного ряда. `day` — 'YYYY-MM-DD' (UTC). */
export interface DayPoint {
  day: string;
  value: number;
}

/**
 * Дни без событий в GROUP BY не попадают, а ряд с дырками рисуется криво:
 * пустой вторник должен быть нулём, а не отсутствовать. Достраиваем полный
 * отрезок и заполняем пропуски нулями.
 *
 * Дни считаются в UTC — как их сгруппировал Postgres. Для сводки этого хватает:
 * сдвиг границы суток на несколько часов не меняет форму тридцатидневного ряда.
 */
function fillDays(rows: { day: string; n: number }[], days: number): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]));
  const out: DayPoint[] = [];
  const start = Date.now() - (days - 1) * DAY;
  for (let i = 0; i < days; i++) {
    const day = new Date(start + i * DAY).toISOString().slice(0, 10);
    out.push({ day, value: byDay.get(day) ?? 0 });
  }
  return out;
}

/**
 * Изменение за последние 7 дней против предыдущих 7. Нужно, чтобы число
 * «за неделю» читалось: сорок регистраций — это много или мало, видно только
 * в сравнении с прошлой неделей.
 */
export interface Delta {
  current: number;
  previous: number;
  /** Прирост в процентах либо null, когда сравнивать не с чем (было ноль). */
  percent: number | null;
}

function delta(current: number, previous: number): Delta {
  return {
    current,
    previous,
    percent: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

export interface TopSong {
  id: string;
  title: string;
  artist: string | null;
  viewCount: number;
  likes: number;
}

export interface TopAuthor {
  id: string;
  name: string | null;
  songs: number;
}

export async function getAdminStats() {
  const week = since(7);
  const month = since(30);
  const twoWeeks = since(14);
  const trendFrom = since(TREND_DAYS);

  const [
    users,
    usersWeek,
    usersMonth,
    usersPrevWeek,
    admins,
    withPassword,
    googleAccounts,
    songs,
    songsWeek,
    songsMonth,
    songsPrevWeek,
    verified,
    withCover,
    byVisibility,
    byInstrument,
    viewSum,
    viewRows,
    guestViewRows,
    likes,
    favorites,
    annotations,
    setlists,
    topByViews,
    topByLikes,
    authorGroups,
    usersDaily,
    songsDaily,
    viewsDaily,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { createdAt: { gte: month } } }),
    // Предыдущая семидневка — чтобы «за 7 дней» можно было с чем-то сравнить.
    prisma.user.count({ where: { createdAt: { gte: twoWeeks, lt: week } } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { passwordHash: { not: null } } }),
    prisma.account.count({ where: { provider: 'google' } }),

    prisma.song.count(),
    prisma.song.count({ where: { createdAt: { gte: week } } }),
    prisma.song.count({ where: { createdAt: { gte: month } } }),
    prisma.song.count({ where: { createdAt: { gte: twoWeeks, lt: week } } }),
    prisma.song.count({ where: { verified: true } }),
    prisma.song.count({ where: { hasCover: true } }),
    prisma.song.groupBy({ by: ['visibility'], _count: { _all: true } }),
    prisma.song.groupBy({ by: ['instrument'], _count: { _all: true } }),

    prisma.song.aggregate({ _sum: { viewCount: true } }),
    prisma.view.count(),
    prisma.view.count({ where: { visitorId: { not: null } } }),
    prisma.like.count(),
    prisma.favorite.count(),
    prisma.annotation.count(),
    prisma.setlist.count(),

    prisma.song.findMany({
      where: { visibility: 'public' },
      orderBy: [{ viewCount: 'desc' }, { id: 'desc' }],
      take: 10,
      select: { id: true, title: true, artist: true, viewCount: true, _count: { select: { likes: true } } },
    }),
    prisma.song.findMany({
      where: { visibility: 'public' },
      orderBy: [{ likes: { _count: 'desc' } }, { id: 'desc' }],
      take: 10,
      select: { id: true, title: true, artist: true, viewCount: true, _count: { select: { likes: true } } },
    }),
    prisma.song.groupBy({
      by: ['userId'],
      where: { visibility: 'public' },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),

    // Дневные ряды. Группировка считается в БД одним запросом на ряд: тридцать
    // отдельных счётчиков на график — это тридцать round-trip'ов до Neon, а он
    // в другом полушарии. Имя таблицы параметром не подставить, поэтому три
    // почти одинаковых запроса, а не один с подстановкой.
    prisma.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
             count(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${trendFrom}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
             count(*)::int AS n
      FROM "Song" WHERE "createdAt" >= ${trendFrom}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "viewedAt"), 'YYYY-MM-DD') AS day,
             count(*)::int AS n
      FROM "View" WHERE "viewedAt" >= ${trendFrom}
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  // Имена авторов — отдельным запросом: groupBy их не отдаёт, а join ради
  // десяти строк не нужен.
  const authors = await prisma.user.findMany({
    where: { id: { in: authorGroups.map((g) => g.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));

  const visibility = { public: 0, unlisted: 0, private: 0 } as Record<string, number>;
  for (const row of byVisibility) visibility[row.visibility] = row._count._all;

  const instrument: Record<InstrumentId, number> = { guitar: 0, ukulele: 0 };
  for (const row of byInstrument) instrument[parseInstrumentId(row.instrument)] += row._count._all;

  const toTop = (rows: typeof topByViews): TopSong[] =>
    rows.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      viewCount: s.viewCount,
      likes: s._count.likes,
    }));

  return {
    users: {
      total: users,
      week: usersWeek,
      month: usersMonth,
      weekDelta: delta(usersWeek, usersPrevWeek),
      admins,
      withPassword,
      googleAccounts,
    },
    songs: {
      total: songs,
      week: songsWeek,
      month: songsMonth,
      weekDelta: delta(songsWeek, songsPrevWeek),
      verified,
      withCover,
      visibility,
      instrument,
    },
    trends: {
      days: TREND_DAYS,
      users: fillDays(usersDaily, TREND_DAYS),
      songs: fillDays(songsDaily, TREND_DAYS),
      // Ряд по View.viewedAt. Это НЕ число просмотров за день: отметка одна на
      // пару «зритель + разбор», и повторный заход двигает ей дату. То есть
      // свежие дни точны, а чем день старше, тем сильнее он занижен — тех, кто
      // с тех пор заходил снова, из него уже вычли. Подпись у графика об этом
      // говорит прямо, чтобы ряд не читали как посещаемость.
      views: fillDays(viewsDaily, TREND_DAYS),
    },
    engagement: {
      // Сумма денормализованных счётчиков — то же число, что видит посетитель.
      views: viewSum._sum.viewCount ?? 0,
      // Отметки в View: их меньше, чем просмотров, если счётчик накручивали
      // скриптом — расхождение здесь честно видно.
      viewRows,
      guestViewRows,
      accountViewRows: viewRows - guestViewRows,
      likes,
      favorites,
      annotations,
      setlists,
    },
    topByViews: toTop(topByViews),
    topByLikes: toTop(topByLikes),
    topAuthors: authorGroups.map<TopAuthor>((g) => ({
      id: g.userId,
      name: nameById.get(g.userId) ?? null,
      songs: g._count._all,
    })),
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
