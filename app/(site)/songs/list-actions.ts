'use server';

import { requireUser } from '@/lib/session';
import { listSongs, type SongListPage } from '@/lib/songs';
import { parseInstrumentId } from '@/lib/chords/instruments';

/**
 * Следующая порция своей библиотеки для кнопки «Показать ещё».
 *
 * Владельца берём ИЗ СЕССИИ, а не из аргументов: фильтры связываются с экшеном
 * на сервере, но уезжают на клиент и возвращаются оттуда — доверять им нельзя,
 * иначе подменой аргумента можно было бы вычитать чужую библиотеку (там есть и
 * приватные разборы).
 */
export async function loadMoreLibraryAction(
  filters: { query?: string; instrument?: string },
  page: number,
): Promise<SongListPage> {
  const user = await requireUser();
  return listSongs(user.id, {
    query: filters.query,
    instrument: parseInstrumentId(filters.instrument),
    page,
  });
}
