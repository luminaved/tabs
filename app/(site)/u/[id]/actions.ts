'use server';

import { listUserPublicSongs, type SongListPage } from '@/lib/engagement';
import { parseInstrumentId } from '@/lib/chords/instruments';

/**
 * Следующая порция разборов автора. Входа не требует: `listUserPublicSongs`
 * сама отдаёт только публичные разборы, поэтому подмена аргументов ничего не
 * открывает — максимум покажет другого автора, что и так доступно по ссылке.
 */
export async function loadMoreUserSongsAction(
  filters: { userId: string; query?: string; instrument?: string },
  page: number,
): Promise<SongListPage> {
  if (!filters.userId) return { songs: [], hasMore: false };
  return listUserPublicSongs(filters.userId, {
    query: filters.query,
    instrument: filters.instrument ? parseInstrumentId(filters.instrument) : undefined,
    page,
  });
}
