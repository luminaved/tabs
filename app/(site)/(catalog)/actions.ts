'use server';

import { listPublicSongs, parseSort, type CatalogPage } from '@/lib/songs';
import { parseInstrumentId } from '@/lib/chords/instruments';

/**
 * Следующая порция каталога для кнопки «Показать ещё».
 *
 * Отдаёт только публичные разборы (это гарантирует `listPublicSongs`), поэтому
 * экшен не требует входа. Номер страницы ограничен сверху, чтобы запросом
 * нельзя было заставить БД листать выдачу бесконечно далеко.
 */
export async function loadMoreCatalogAction(input: {
  query?: string;
  sort?: string;
  instrument?: string;
  verified?: boolean;
  page: number;
}): Promise<CatalogPage> {
  const page = Math.min(Math.max(1, Math.trunc(input.page) || 1), 200);
  return listPublicSongs({
    query: input.query,
    sort: parseSort(input.sort),
    instrument: parseInstrumentId(input.instrument),
    verified: !!input.verified,
    page,
  });
}
