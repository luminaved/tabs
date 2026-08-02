import Link from 'next/link';
import type { SongCard } from '@/lib/engagement';
import { INSTRUMENTS, parseInstrumentId } from '@/lib/chords/instruments';
import { songPath } from '@/lib/slug';
import { SongThumb } from './SongThumb';
import { SongChordChips } from './SongChordChips';
import { VerifiedBadge } from './VerifiedBadge';

/**
 * Строка песни в списке: обложка, название, мета + лайки, чипы аккордов.
 *
 * Инструмент помечается бейджем только когда он НЕ гитара: гитара — основной
 * случай, и подпись в каждой строке была бы шумом, а укулеле важно отличить.
 */
export function SongRow({ song, meta }: { song: SongCard; meta?: React.ReactNode }) {
  const instrument = parseInstrumentId(song.instrument);
  return (
    <Link href={songPath(song)} className="song-row">
      <SongThumb songId={song.id} hasCover={song.hasCover} updatedAt={song.updatedAt} />
      <div className="min-w-0 flex-1">
        {/* Отступы — как в каталоге: галочка вплотную к названию, бейдж дальше */}
        <div className="flex items-center gap-1">
          <span className="truncate text-lg font-medium">{song.title}</span>
          {song.verified ? <VerifiedBadge size={19} /> : null}
          {instrument !== 'guitar' ? (
            <span className="inst-badge ms-1 shrink-0">{INSTRUMENTS[instrument].name}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="truncate">
            {meta ?? (
              <>
                {song.artist || 'без исполнителя'}
                {song.key ? ` · ${song.key}` : ''}
              </>
            )}
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
      <SongChordChips chords={song.chords} />
    </Link>
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
