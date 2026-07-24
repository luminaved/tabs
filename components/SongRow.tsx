import Link from 'next/link';
import type { SongCard } from '@/lib/engagement';
import { SongThumb } from './SongThumb';
import { SongChordChips } from './SongChordChips';

/** Строка песни в списке: обложка, название, мета + лайки, чипы аккордов. */
export function SongRow({ song, meta }: { song: SongCard; meta?: React.ReactNode }) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="group flex items-center gap-4 rounded-xl border border-line px-3 py-3 transition hover:border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-line))]"
    >
      <SongThumb src={song.coverUrl} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-medium">{song.title}</div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="truncate">
            {meta ?? (
              <>
                {song.artist || 'без исполнителя'}
                {song.key ? ` · ${song.key}` : ''}
              </>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1" title="Лайки">
            <HeartIcon />
            {song._count.likes}
          </span>
        </div>
      </div>
      <SongChordChips body={song.body} />
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
