import Link from 'next/link';
import type { CatalogSong } from '@/lib/songs';
import { INSTRUMENTS, parseInstrumentId } from '@/lib/chords/instruments';
import { songPath } from '@/lib/slug';
import { SongThumb } from './SongThumb';
import { SongChordChips } from './SongChordChips';
import { VerifiedBadge } from './VerifiedBadge';

/**
 * Строка каталога: обложка, название, исполнитель и автор разбора (обе —
 * отдельные ссылки поверх «растянутой»), счётчики и чипы аккордов.
 *
 * Вынесена из страницы каталога, потому что те же строки дорисовывает
 * подгрузка следующей порции ([LoadMoreCatalog](./LoadMoreCatalog.tsx)).
 */
export function CatalogRow({ song }: { song: CatalogSong }) {
  return (
    <div className="song-row">
      <SongThumb songId={song.id} hasCover={song.hasCover} updatedAt={song.updatedAt} />
      <div className="min-w-0 flex-1">
        {/* gap-1: галочка относится к названию, поэтому жмётся к нему вплотную,
            а бейдж инструмента отделён своим отступом (ms-1). */}
        <Link
          href={songPath(song)}
          className="stretched-link flex items-center gap-1 text-lg font-medium"
        >
          <span className="truncate">{song.title}</span>
          {song.verified ? <VerifiedBadge size={19} /> : null}
          {/* Каталоги разделены по инструментам, но строка используется и там,
              где они смешаны — бейджем помечаем всё, кроме гитары. */}
          {parseInstrumentId(song.instrument) !== 'guitar' ? (
            <span className="inst-badge ms-1 shrink-0">
              {INSTRUMENTS[parseInstrumentId(song.instrument)].name}
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="truncate">
            {/* Исполнитель ведёт на все его разборы. z-[1] — чтобы ссылка
                работала поверх «растянутой» ссылки строки. */}
            {song.artist ? (
              <Link
                href={`/artist/${encodeURIComponent(song.artist)}`}
                className="relative z-[1] hover:text-[var(--color-fg)] hover:underline"
              >
                {song.artist}
              </Link>
            ) : (
              'без исполнителя'
            )}
            {song.key ? ` · ${song.key}` : ''}
            {song.user.name ? (
              <>
                {' · '}
                <Link
                  href={`/u/${song.user.id}`}
                  className="relative z-[1] hover:text-[var(--color-fg)] hover:underline"
                >
                  {song.user.name}
                </Link>
              </>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1" title="Просмотры">
            <EyeIcon />
            {song.viewCount}
          </span>
          <span className="flex shrink-0 items-center gap-1" title="Лайки">
            <HeartIcon />
            {song._count.likes}
          </span>
        </div>
      </div>
      <SongChordChips chords={song.chords} capo={song.capo} />
    </div>
  );
}

function HeartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-muted">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-muted">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
