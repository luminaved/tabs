'use server';

import { listSongsByArtist, type SongListPage } from '@/lib/songs';

/**
 * Следующая порция разборов исполнителя. Как и у автора, входа не требует —
 * выборка ограничена публичными разборами на уровне запроса.
 */
export async function loadMoreArtistSongsAction(
  filters: { artist: string },
  page: number,
): Promise<SongListPage> {
  if (!filters.artist?.trim()) return { songs: [], hasMore: false };
  return listSongsByArtist(filters.artist, { page });
}
