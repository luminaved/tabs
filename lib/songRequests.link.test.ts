import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Чтение списка заявок и ручная привязка — на подменённой базе.
 *
 * Подмена не проверяет SQL (за него отвечает типизация Prisma), зато проверяет
 * то, что в этом коде своё: что закрывает заявку, что сильнее — ручная привязка
 * или автосвязь — и что происходит, когда разбор спрятали.
 */

interface FakeSong {
  id: string;
  title: string;
  artist: string | null;
  instrument: string;
  visibility: string;
  viewCount?: number;
}
interface FakeRequest {
  id: string;
  title: string;
  artist: string | null;
  instrument: string;
  songId: string | null;
  createdAt: Date;
  _count: { votes: number };
}

const db = vi.hoisted(() => ({
  songs: [] as FakeSong[],
  requests: [] as FakeRequest[],
  updates: [] as { where: unknown; data: unknown }[],
}));

vi.mock('./db', () => ({
  prisma: {
    song: {
      findMany: async ({ where }: { where: { id?: { in: string[] }; visibility?: string } }) =>
        db.songs.filter(
          (s) =>
            (!where.visibility || s.visibility === where.visibility) &&
            (!where.id || where.id.in.includes(s.id)),
        ),
      findFirst: async ({ where }: { where: { id: string; visibility: string } }) =>
        db.songs.find((s) => s.id === where.id && s.visibility === where.visibility) ?? null,
    },
    songRequest: {
      findMany: async () => db.requests,
      updateMany: async (args: { where: { id: string }; data: { songId: string | null } }) => {
        db.updates.push(args);
        const r = db.requests.find((x) => x.id === args.where.id);
        if (r) r.songId = args.data.songId;
        return { count: r ? 1 : 0 };
      },
    },
  },
}));

// Кэш Next вне запроса не работает — здесь он просто вызывает функцию.
vi.mock('./cache', () => ({
  SONGS_TAG: 'songs',
  cachedByKey: <T>(_key: string[], _tags: string[], fn: () => Promise<T>) => fn(),
}));

import {
  linkRequestToSong,
  listRequests,
  searchSongsForLink,
  unlinkRequest,
} from './songRequests';

const request = (over: Partial<FakeRequest> & Pick<FakeRequest, 'id' | 'title'>): FakeRequest => ({
  artist: null,
  instrument: 'guitar',
  songId: null,
  createdAt: new Date('2026-01-01'),
  _count: { votes: 1 },
  ...over,
});

beforeEach(() => {
  db.songs = [];
  db.requests = [];
  db.updates = [];
});

describe('listRequests: автосвязь', () => {
  it('закрывает заявку разбором, записанным с маленькой буквы', async () => {
    db.songs = [
      { id: 'cs1', title: 'тривога и паничка', artist: 'впустоте', instrument: 'guitar', visibility: 'public' },
    ];
    db.requests = [request({ id: 'r1', title: 'Тривога и паничка', artist: 'Впустоте' })];

    const [row] = await listRequests(null);

    expect(row.fulfilledPath).toMatch(/^\/songs\/.*cs1$/);
    expect(row.linkedManually).toBe(false);
  });

  it('приватный и «по ссылке» разбор заявку не закрывает', async () => {
    db.songs = [
      { id: 'a', title: 'Кошка', artist: 'Кишлак', instrument: 'guitar', visibility: 'private' },
      { id: 'b', title: 'Кошка', artist: 'Кишлак', instrument: 'guitar', visibility: 'unlisted' },
    ];
    db.requests = [request({ id: 'r1', title: 'Кошка', artist: 'Кишлак' })];

    expect((await listRequests(null))[0].fulfilledPath).toBeNull();
  });
});

describe('listRequests: ручная привязка', () => {
  it('привязанная к публичному разбору заявка закрыта, даже если названия не совпадают', async () => {
    db.songs = [
      { id: 'cs1', title: 'Тревога и паника (live)', artist: 'В пустоте', instrument: 'guitar', visibility: 'public' },
    ];
    db.requests = [request({ id: 'r1', title: 'Тривога и паничка', artist: 'Впустоте', songId: 'cs1' })];

    const [row] = await listRequests(null);

    expect(row.fulfilledPath).toMatch(/cs1$/);
    expect(row.linkedManually).toBe(true);
  });

  it('привязка сильнее автосвязи', async () => {
    db.songs = [
      { id: 'auto', title: 'Кошка', artist: 'Кишлак', instrument: 'guitar', visibility: 'public' },
      { id: 'manual', title: 'Кошка (cover)', artist: 'Кто-то', instrument: 'guitar', visibility: 'public' },
    ];
    db.requests = [request({ id: 'r1', title: 'Кошка', artist: 'Кишлак', songId: 'manual' })];

    const [row] = await listRequests(null);

    expect(row.fulfilledPath).toMatch(/manual$/);
    expect(row.linkedManually).toBe(true);
  });

  it('разбор спрятали — заявка снова открыта', async () => {
    db.songs = [
      { id: 'cs1', title: 'Другое', artist: 'Другой', instrument: 'guitar', visibility: 'private' },
    ];
    db.requests = [request({ id: 'r1', title: 'Тривога и паничка', artist: 'Впустоте', songId: 'cs1' })];

    const [row] = await listRequests(null);

    expect(row.fulfilledPath).toBeNull();
    expect(row.linkedManually).toBe(false);
  });

  it('если ручная привязка потеряла силу, а автосвязь есть — заявка закрыта автосвязью', async () => {
    db.songs = [
      { id: 'gone', title: 'Х', artist: 'Y', instrument: 'guitar', visibility: 'private' },
      { id: 'auto', title: 'Кошка', artist: 'Кишлак', instrument: 'guitar', visibility: 'public' },
    ];
    db.requests = [request({ id: 'r1', title: 'Кошка', artist: 'Кишлак', songId: 'gone' })];

    const [row] = await listRequests(null);

    expect(row.fulfilledPath).toMatch(/auto$/);
    expect(row.linkedManually).toBe(false);
  });
});

describe('linkRequestToSong / unlinkRequest', () => {
  it('привязывает к публичному разбору', async () => {
    db.songs = [{ id: 'cs1', title: 'A', artist: 'B', instrument: 'guitar', visibility: 'public' }];
    db.requests = [request({ id: 'r1', title: 'X' })];

    expect(await linkRequestToSong('r1', 'cs1')).toEqual({ ok: true });
    expect(db.requests[0].songId).toBe('cs1');
  });

  it('отказывает для непубличного или несуществующего разбора', async () => {
    db.songs = [{ id: 'cs1', title: 'A', artist: 'B', instrument: 'guitar', visibility: 'private' }];
    db.requests = [request({ id: 'r1', title: 'X' })];

    expect((await linkRequestToSong('r1', 'cs1')).ok).toBe(false);
    expect((await linkRequestToSong('r1', 'nope')).ok).toBe(false);
    expect(db.requests[0].songId).toBeNull();
  });

  it('отказывает, если заявки уже нет', async () => {
    db.songs = [{ id: 'cs1', title: 'A', artist: 'B', instrument: 'guitar', visibility: 'public' }];
    expect((await linkRequestToSong('missing', 'cs1')).ok).toBe(false);
  });

  it('отвязка обнуляет songId', async () => {
    db.requests = [request({ id: 'r1', title: 'X', songId: 'cs1' })];
    await unlinkRequest('r1');
    expect(db.requests[0].songId).toBeNull();
  });
});

describe('searchSongsForLink', () => {
  const row = (id: string, title: string, artist: string | null, instrument = 'guitar'): FakeSong => ({
    id,
    title,
    artist,
    instrument,
    visibility: 'public',
  });

  it('пустой запрос ничего не ищет', async () => {
    expect(await searchSongsForLink('   ')).toEqual([]);
  });

  it('находит по id и по ссылке на разбор', async () => {
    db.songs = [row('cmrxly6830002uk40abcdefgh', 'Тривога', 'Впустоте')];
    const byId = await searchSongsForLink('cmrxly6830002uk40abcdefgh');
    const byUrl = await searchSongsForLink(
      'https://rawchords.vercel.app/songs/trivoga-vpustote-cmrxly6830002uk40abcdefgh?x=1',
    );
    expect(byId.map((m) => m.id)).toEqual(['cmrxly6830002uk40abcdefgh']);
    expect(byUrl.map((m) => m.id)).toEqual(['cmrxly6830002uk40abcdefgh']);
  });

  it('отсеивает попадания по тексту песни и считает ё как е', async () => {
    // Подмена базы отдаёт всё подряд — отбор по названию делает сам код.
    db.songs = [
      row('1', 'Самолёты', 'Земфира'),
      row('2', 'Совсем другое', 'Кто-то'),
    ];
    const res = await searchSongsForLink('самолеты');
    expect(res.map((m) => m.id)).toEqual(['1']);
  });

  it('ставит выше разбор того же инструмента, что у заявки', async () => {
    db.songs = [row('g', 'Кошка', 'Кишлак', 'guitar'), row('u', 'Кошка', 'Кишлак', 'ukulele')];
    const res = await searchSongsForLink('кошка', 'ukulele');
    expect(res.map((m) => m.id)).toEqual(['u', 'g']);
  });
});
