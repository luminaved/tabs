import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { slugify, songIdFromParam, songPath } from './slug';
import { parseInstrumentId, type InstrumentId } from './chords/instruments';
import { normalizeSearchQuery, searchQueryForLike } from './chordpro/searchText';
import { SONGS_TAG, cachedByKey } from './cache';
import { buildSongIndex, findSongForRequest, type MatchSong } from './requestMatch';

/**
 * Заявки на разборы: «этой песни у вас нет, сделайте».
 *
 * Зачем это вообще нужно, кроме вежливости: почти весь трафик приходит из
 * поиска и уходит, ничего не оставив. Заявка — единственный способ узнать, что
 * именно люди искали и не нашли, то есть превратить промах в список дел.
 * Поэтому заявку можно оставить БЕЗ регистрации: требовать аккаунт ради двух
 * полей — значит не получить ни заявок, ни данных.
 */

/** Сколько заявок показываем на странице. Больше — уже не список, а свалка. */
export const REQUESTS_LIMIT = 100;

export const TITLE_MAX = 120;
export const ARTIST_MAX = 120;

/**
 * Ключ, по которому заявки склеиваются в одну.
 *
 * Считается тем же `slugify`, что и подписи в адресах: он уже приводит регистр,
 * снимает пунктуацию и переводит кириллицу в латиницу, поэтому «Кошка»,
 * «кошка!» и «КОШКА » дают один ключ, а не три заявки об одном.
 *
 * Инструмент в ключе не для порядка: каталоги разделены, и просьба «на укулеле»
 * — это другая работа, а не та же самая.
 *
 * Запасной вариант на случай, если от названия не осталось ни одного латинского
 * символа (название из одних знаков или, скажем, иероглифов): берём сырую
 * строку в нижнем регистре — склейка станет строже, но ключ не выродится в
 * пустоту, общую для всех таких заявок.
 */
export function requestMatchKey(input: {
  title: string;
  artist?: string | null;
  instrument: string;
}): string {
  const inst = parseInstrumentId(input.instrument);
  const slug = slugify([input.title, input.artist].filter(Boolean).join(' '));
  if (slug) return `${inst}:${slug}`;

  const raw = [input.title, input.artist]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return `${inst}:raw:${raw}`;
}

export interface RequestInput {
  title: string;
  artist?: string | null;
  instrument: InstrumentId;
}

/** Кто просит: аккаунт либо суточный отпечаток гостя (как у просмотров). */
export type RequesterRef = { userId: string } | { visitorId: string };

export interface RequestResult {
  /** Заявка создана впервые (а не превратилась в голос за существующую). */
  created: boolean;
  /** Голос засчитан. false — этот же проситель уже голосовал сегодня. */
  voted: boolean;
  id: string;
}

/**
 * Создать заявку либо проголосовать за уже существующую.
 *
 * Один путь на оба случая намеренно: человек не обязан знать, просил ли эту
 * песню кто-то до него, и не должен получать «такая заявка уже есть» вместо
 * результата. Дубликат — это и есть голос.
 *
 * `upsert` по `matchKey` вместо «поискать и создать»: между проверкой и
 * вставкой заявку успевает создать параллельный запрос, и уникальный индекс
 * отдал бы ошибку вместо голоса.
 */
export async function createOrVote(
  input: RequestInput,
  requester: RequesterRef | null,
): Promise<RequestResult> {
  const title = input.title.trim().slice(0, TITLE_MAX);
  const artist = input.artist?.trim().slice(0, ARTIST_MAX) || null;
  const matchKey = requestMatchKey({ title, artist, instrument: input.instrument });

  const before = await prisma.songRequest.findUnique({
    where: { matchKey },
    select: { id: true },
  });

  const request = await prisma.songRequest.upsert({
    where: { matchKey },
    // Уже есть — не трогаем: первое написание названия остаётся за первым
    // просившим, иначе каждый следующий переписывал бы чужую заявку.
    update: {},
    create: { title, artist, instrument: input.instrument, matchKey },
    select: { id: true },
  });

  // Бот (отпечатка нет) заявку создать может, а голос ему не засчитываем.
  if (!requester) return { created: !before, voted: false, id: request.id };

  let voted = true;
  try {
    await prisma.songRequestVote.create({
      data: {
        requestId: request.id,
        ...('userId' in requester
          ? { userId: requester.userId }
          : { visitorId: requester.visitorId }),
      },
    });
  } catch (error) {
    // P2002 — этот проситель уже голосовал. Не ошибка сценария, а ровно то, от
    // чего стоит уникальный индекс: молча оставляем счётчик как есть.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    voted = false;
  }

  return { created: !before, voted, id: request.id };
}

/**
 * Голос за СУЩЕСТВУЮЩУЮ заявку. Ничего не создаёт — и в этом весь смысл.
 *
 * Раньше кнопка «+1» звала `createOrVote`, а тот при отсутствии заявки заводит
 * новую. Значит удаление спама админом отменялось первым же кликом с чужой
 * открытой вкладки: заявка возвращалась. Голос обязан быть только голосом.
 *
 * Возвращает false, если заявки уже нет: страница просто обновится без неё.
 */
export async function voteForRequest(
  requestId: string,
  requester: RequesterRef,
): Promise<boolean> {
  const exists = await prisma.songRequest.findUnique({
    where: { id: requestId },
    select: { id: true },
  });
  if (!exists) return false;

  try {
    await prisma.songRequestVote.create({
      data: {
        requestId,
        ...('userId' in requester
          ? { userId: requester.userId }
          : { visitorId: requester.visitorId }),
      },
    });
    return true;
  } catch (error) {
    // Уже голосовал — не ошибка, ровно то, от чего стоит уникальный индекс.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

export interface RequestRow {
  id: string;
  title: string;
  artist: string | null;
  instrument: InstrumentId;
  votes: number;
  createdAt: Date;
  /** Разбор появился — адрес готовой песни. */
  fulfilledPath: string | null;
  /** Заявка закрыта привязкой, которую администратор поставил вручную. */
  linkedManually: boolean;
  /** Этот проситель уже голосовал. */
  mine: boolean;
}

/**
 * Список заявок: сначала те, кого просят чаще.
 *
 * Выполненные заявки НЕ удаляются и не прячутся — они и есть доказательство,
 * что просить имеет смысл. Пустой список заявок, где всё сделанное стёрто,
 * выглядит как заброшенная форма.
 */
export async function listRequests(requester: RequesterRef | null): Promise<RequestRow[]> {
  const rows = await prisma.songRequest.findMany({
    orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'desc' }],
    take: REQUESTS_LIMIT,
    select: {
      id: true,
      title: true,
      artist: true,
      instrument: true,
      songId: true,
      createdAt: true,
      _count: { select: { votes: true } },
      ...(requester
        ? {
            votes: {
              where: 'userId' in requester ? { userId: requester.userId } : { visitorId: requester.visitorId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
    },
  });

  const manual = await findManualLinks(rows);
  // Автосовпадение ищем только для тех, у кого ручной привязки нет: она сильнее.
  const auto = await findFulfilled(rows.filter((r) => !manual.has(r.id)));

  return rows.map((r) => {
    const manualPath = manual.get(r.id) ?? null;
    return {
      id: r.id,
      title: r.title,
      artist: r.artist,
      instrument: parseInstrumentId(r.instrument),
      votes: r._count.votes,
      createdAt: r.createdAt,
      fulfilledPath: manualPath ?? auto.get(r.id) ?? null,
      linkedManually: manualPath !== null,
      mine: !!('votes' in r && r.votes?.length),
    };
  });
}

/**
 * Заявки, привязанные к разбору вручную: id заявки → адрес разбора.
 *
 * Привязка учитывается, только пока разбор публичный. Спрятали или удалили
 * разбор — заявка снова открыта (удаление к тому же обнуляет `songId` само, см.
 * `onDelete: SetNull`). Так же ведёт себя и автосвязь: ничего не залипает.
 */
async function findManualLinks(
  rows: { id: string; songId: string | null }[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.songId).filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();

  const songs = await prisma.song.findMany({
    where: { id: { in: ids }, visibility: 'public' },
    select: { id: true, title: true, artist: true },
  });
  const pathById = new Map(songs.map((s) => [s.id, songPath(s)]));

  const out = new Map<string, string>();
  for (const r of rows) {
    const path = r.songId ? pathById.get(r.songId) : undefined;
    if (path) out.set(r.id, path);
  }
  return out;
}

/**
 * Публичные разборы в порядке выхода — для автосвязи заявок.
 *
 * Только четыре короткие колонки, без текста песни. Кэшируется под тем же тегом,
 * что и каталог: публикация, правка и удаление разбора сбрасывают его сами, так
 * что заявка закрывается сразу после выхода разбора, а не через TTL.
 */
function loadPublicSongIndexSource(): Promise<MatchSong[]> {
  return cachedByKey(['request-song-index'], [SONGS_TAG], () =>
    prisma.song.findMany({
      where: { visibility: 'public' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true, artist: true, instrument: true },
    }),
  );
}

/**
 * Какие заявки уже закрыты вышедшим разбором: id заявки → адрес разбора.
 *
 * Связь считается ПРИ ЧТЕНИИ, а не хранится полем на заявке. Так нет
 * рассинхрона: разбор удалили или спрятали — заявка сама снова становится
 * открытой, и никакой фоновой сверки для этого не нужно.
 *
 * Сравнение делает JavaScript (`lib/requestMatch.ts`), а не база: раньше это
 * был `equals … mode: insensitive`, и он промахивался на регистре кириллицы,
 * ё и невидимых различиях в пробелах. Карта заполняется id заявки: заявки без
 * исполнителя (записи со времён, когда поле было необязательным) закрываются
 * любым разбором с тем же названием, и ключ «название + исполнитель» у них с
 * разбором не совпал бы никогда.
 */
async function findFulfilled(
  rows: { id: string; title: string; artist: string | null; instrument: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;

  const index = buildSongIndex(await loadPublicSongIndexSource());
  for (const r of rows) {
    const song = findSongForRequest(index, r);
    if (song) out.set(r.id, songPath(song));
  }
  return out;
}

/** Удаление заявки — только администратору (см. экшен). */
export async function deleteRequest(id: string): Promise<void> {
  await prisma.songRequest.deleteMany({ where: { id } });
}

export type LinkResult = { ok: true } | { ok: false; error: string };

/**
 * Привязать заявку к готовому разбору вручную — на случай, когда автосвязь
 * промахнулась (иначе записан исполнитель, другое написание названия).
 *
 * Привязать можно только к ПУБЛИЧНОМУ разбору: в «Разобрано» заявка показывает
 * ссылку на него всем, а приватный или «по ссылке» разбор чужим не показывается
 * нигде, и привязка не исключение. Иначе заявка, привязанная к непубличному
 * разбору, выглядела бы «ждущей» без объяснения.
 */
export async function linkRequestToSong(requestId: string, songId: string): Promise<LinkResult> {
  const song = await prisma.song.findFirst({
    where: { id: songId, visibility: 'public' },
    select: { id: true },
  });
  if (!song) return { ok: false, error: 'Разбор не найден или не опубликован (нужна видимость «публичный»).' };

  const res = await prisma.songRequest.updateMany({
    where: { id: requestId },
    data: { songId: song.id },
  });
  if (res.count === 0) return { ok: false, error: 'Заявка не найдена — возможно, её уже удалили.' };
  return { ok: true };
}

/** Снять ручную привязку. Автосвязь по названию при этом продолжает работать. */
export async function unlinkRequest(requestId: string): Promise<void> {
  await prisma.songRequest.updateMany({ where: { id: requestId }, data: { songId: null } });
}

/** Нижний регистр и ё=е: так админ находит «самолёты», набрав «самолеты». */
function foldForSearch(s: string): string {
  return s.toLowerCase().replaceAll('ё', 'е');
}

/**
 * Поиск разбора для ручной привязки (только админ, см. экшен).
 *
 * Принимает название/исполнителя словами — порядок и регистр не важны, — либо
 * ссылку на разбор, либо его id: когда нужную песню проще открыть и скопировать
 * адрес, чем угадывать, как она записана.
 *
 * Регистр снимаем в JS и ищем по `searchText` (он уже в нижнем регистре), а не
 * полагаемся на `mode: insensitive`: на нём автосвязь и споткнулась. Попавшие
 * по тексту песни (не по названию) отсеиваются вторым проходом.
 */
export async function searchSongsForLink(
  query: string,
  instrument?: string,
  limit = 8,
): Promise<CatalogMatch[]> {
  const raw = String(query ?? '').trim().slice(0, 300);
  if (!raw) return [];

  const urlPart = raw.match(/\/songs\/([^/?#\s]+)/)?.[1];
  const id = urlPart ? songIdFromParam(urlPart) : /^c[a-z0-9]{20,}$/.test(raw) ? raw : null;
  if (id) {
    const song = await prisma.song.findFirst({
      where: { id, visibility: 'public' },
      select: { id: true, title: true, artist: true, instrument: true },
    });
    return song ? [toMatch(song)] : [];
  }

  const normalized = normalizeSearchQuery(raw);
  if (!normalized) return [];
  const words = normalized.split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return [];

  const rows = await prisma.song.findMany({
    where: {
      visibility: 'public',
      AND: words.map((w) => {
        const like = searchQueryForLike(w)!;
        return {
          OR: [
            { searchText: { contains: like } },
            { title: { contains: like, mode: 'insensitive' as const } },
            { artist: { contains: like, mode: 'insensitive' as const } },
          ],
        };
      }),
    },
    orderBy: [{ viewCount: 'desc' }, { id: 'desc' }],
    take: 60,
    select: { id: true, title: true, artist: true, instrument: true },
  });

  const needles = words.map(foldForSearch);
  const hits = rows.filter((r) => {
    const hay = foldForSearch(`${r.title} ${r.artist ?? ''}`);
    return needles.every((n) => hay.includes(n));
  });

  // Тот же инструмент, что у заявки, — выше; остальной порядок сохраняется.
  const want = instrument ? parseInstrumentId(instrument) : null;
  const ordered = want
    ? [
        ...hits.filter((r) => parseInstrumentId(r.instrument) === want),
        ...hits.filter((r) => parseInstrumentId(r.instrument) !== want),
      ]
    : hits;

  return ordered.slice(0, limit).map(toMatch);
}

function toMatch(r: {
  id: string;
  title: string;
  artist: string | null;
  instrument: string;
}): CatalogMatch {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    instrument: parseInstrumentId(r.instrument),
    path: songPath(r),
  };
}

/** Разбор из каталога, который совпал с тем, что человек печатает в поле заявки. */
export interface CatalogMatch {
  id: string;
  title: string;
  artist: string | null;
  instrument: InstrumentId;
  path: string;
}

/**
 * Что из каталога уже подходит под набранный текст.
 *
 * Нужен полю «найти или запросить»: пока человек печатает, он должен увидеть,
 * что разбор уже есть, — и не заводить заявку на готовую песню. Отсюда два
 * отличия от обычного поиска по каталогу:
 *
 *   — ищем ТОЛЬКО по названию и исполнителю, не по тексту песни. Для каталога
 *     находка строчки из середины — достоинство, а здесь это шум: «я» нашло бы
 *     половину базы, и подсказка «разбор уже есть» стала бы враньём;
 *   — короче двух символов не ищем, по той же причине.
 *
 * Только публичные разборы: приватные и «по ссылке» чужому человеку не
 * показываются нигде, и подсказка не исключение.
 */
export async function findCatalogMatches(query: string, limit = 3): Promise<CatalogMatch[]> {
  const q = searchQueryForLike(query);
  if (!q || q.length < 2) return [];

  const rows = await prisma.song.findMany({
    where: {
      visibility: 'public',
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { artist: { contains: q, mode: 'insensitive' } },
      ],
    },
    // Популярные выше: из нескольких «Самолётов» первым покажем тот, что
    // чаще открывают. id в хвосте — чтобы порядок не плавал между запросами.
    orderBy: [{ viewCount: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { id: true, title: true, artist: true, instrument: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    instrument: parseInstrumentId(r.instrument),
    path: songPath(r),
  }));
}
