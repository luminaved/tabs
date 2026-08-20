import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { slugify, songPath } from './slug';
import { parseInstrumentId, type InstrumentId } from './chords/instruments';

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

  const fulfilled = await findFulfilled(rows);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    instrument: parseInstrumentId(r.instrument),
    votes: r._count.votes,
    createdAt: r.createdAt,
    fulfilledPath: fulfilled.get(requestMatchKey(r)) ?? null,
    mine: !!('votes' in r && r.votes?.length),
  }));
}

/**
 * Какие заявки уже закрыты вышедшим разбором.
 *
 * Связь считается ПРИ ЧТЕНИИ, а не хранится полем на заявке. Так нет
 * рассинхрона: разбор удалили или спрятали — заявка сама снова становится
 * открытой, и никакой фоновой сверки для этого не нужно. Плата — один запрос
 * с перечислением; при потолке в сотню заявок это дёшево.
 *
 * Карта заполняется ключами ЗАЯВОК, а не найденных разборов, и это не
 * придирка. Раньше ключ считался от песни — а для заявки без исполнителя
 * условие в запросе исполнителя не требует, значит подходящий разбор находился
 * с каким-то своим `artist`, и его ключ («название + исполнитель») никогда не
 * совпадал с ключом заявки («только название»). Такие заявки не закрывались ни
 * при каких условиях. Поле стало обязательным на ввод позже, поэтому записи без
 * исполнителя в базе остались.
 */
async function findFulfilled(
  rows: { title: string; artist: string | null; instrument: string }[],
): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();

  const songs = await prisma.song.findMany({
    where: {
      visibility: 'public',
      OR: rows.map((r) => ({
        instrument: parseInstrumentId(r.instrument),
        title: { equals: r.title, mode: 'insensitive' as const },
        ...(r.artist ? { artist: { equals: r.artist, mode: 'insensitive' as const } } : {}),
      })),
    },
    // Для заявки без исполнителя подходящих разборов может оказаться
    // несколько — берём первый вышедший, а не тот, что вернула база.
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, artist: true, instrument: true },
  });

  const byTitle = new Map<string, typeof songs>();
  for (const s of songs) {
    const key = titleKey(s.instrument, s.title);
    const list = byTitle.get(key);
    if (list) list.push(s);
    else byTitle.set(key, [s]);
  }

  const out = new Map<string, string>();
  for (const r of rows) {
    const list = byTitle.get(titleKey(r.instrument, r.title));
    if (!list) continue;
    const artist = r.artist?.toLowerCase();
    // Без исполнителя заявку закрывает любой разбор с тем же названием — так
    // это и задумано для старых записей (см. комментарий у формы заявки).
    const song = artist ? list.find((s) => s.artist?.toLowerCase() === artist) : list[0];
    if (song) out.set(requestMatchKey(r), songPath(song));
  }
  return out;
}

/** «Инструмент + название» — то, по чему запрос уже отобрал разборы. */
function titleKey(instrument: string, title: string): string {
  return `${parseInstrumentId(instrument)}:${title.trim().toLowerCase()}`;
}

/** Удаление заявки — только администратору (см. экшен). */
export async function deleteRequest(id: string): Promise<void> {
  await prisma.songRequest.deleteMany({ where: { id } });
}
