import Link from 'next/link';
import type { SongCard } from '@/lib/engagement';
import { catalogPath, type Instrument } from '@/lib/chords/instruments';
import { songMeta } from '@/lib/songMeta';
import { SongRow } from './SongRow';

/**
 * Блок «что ещё посмотреть» под разбором.
 *
 * Смысл двойной. Человеку — продолжение: разобрал одну песню, рядом лежит
 * следующая. Поиску — выход со страницы: без этого блока разбор был листом, в
 * который обход упирается и разворачивается, а входящих ссылок у соседей было
 * ровно столько, сколько их держится на первой странице каталога.
 *
 * Заголовок зависит от того, что удалось набрать: если соседи — того же
 * исполнителя, так и написано (и это ещё одно вхождение его имени в текст
 * страницы, честное, а не набитое).
 */
export function RelatedSongs({
  songs,
  artist,
  instrument,
}: {
  songs: SongCard[];
  artist: string | null;
  instrument: Instrument;
}) {
  if (songs.length === 0) return null;

  // «Того же исполнителя» — только когда блок действительно из его разборов.
  // Список собирается «сначала исполнитель, потом популярное» (см.
  // listRelatedSongs), поэтому проверять достаточно последнюю строку.
  const byArtist =
    !!artist && songs[songs.length - 1].artist?.trim().toLowerCase() === artist.trim().toLowerCase();

  return (
    <section className="print-hide mt-14 border-t border-line pt-8">
      <h2 className="display mb-4 text-2xl font-medium">
        {byArtist ? `Другие разборы: ${artist}` : `Похожие разборы для ${instrument.forName}`}
      </h2>

      <ul className="flex flex-col gap-2">
        {songs.map((song) => (
          <li key={song.id}>
            <SongRow song={song} meta={byArtist ? songMeta(song, 'artist') : undefined} />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm">
        <Link
          href={byArtist && artist ? `/artist/${encodeURIComponent(artist)}` : catalogPath(instrument.id)}
          className="text-accent underline-offset-4 hover:underline"
        >
          {/* Двоеточие вместо согласования: имена исполнителей не склоняются
              («все аккорды Кишлак» — так же плохо, как «Alex G-а»). */}
          {byArtist && artist
            ? `Все аккорды: ${artist} →`
            : `Весь каталог аккордов для ${instrument.forName} →`}
        </Link>
      </p>
    </section>
  );
}
