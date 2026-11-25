/**
 * Подпись под названием в строке списка.
 *
 * Живёт отдельным модулем, потому что первую страницу рисует сервер, а
 * подгруженные — клиент ([LoadMoreSongs](../components/LoadMoreSongs.tsx)):
 * будь эта логика в любом из них, вторая страница выглядела бы иначе первой.
 *
 * Тип аргумента структурный, без импорта `SongCard`: тот тянется из модуля с
 * Prisma, и нечаянный не-типовой импорт утащил бы клиентский бандл за собой.
 */

const VIS_LABEL: Record<string, string> = {
  private: 'приватная',
  unlisted: 'по ссылке',
  public: 'публичная',
};

export type SongMetaKind = 'library' | 'artist';

interface SongMetaFields {
  artist: string | null;
  key: string | null;
  visibility: string;
}

export function songMeta(song: SongMetaFields, kind?: SongMetaKind): string | undefined {
  // Своя библиотека: исполнитель и тональность плюс видимость — здесь важно
  // с одного взгляда видеть, что ещё не опубликовано.
  if (kind === 'library') {
    return [song.artist || 'без исполнителя', song.key, VIS_LABEL[song.visibility]]
      .filter(Boolean)
      .join(' · ');
  }
  // Страница исполнителя: имя повторять незачем, оно в заголовке.
  if (kind === 'artist') {
    return [song.key, 'аккорды'].filter(Boolean).join(' · ');
  }
  // Иначе строка сама покажет исполнителя и тональность.
  return undefined;
}
