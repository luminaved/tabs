import { coverSrc } from '@/lib/coverUrl';

/**
 * Маленькая обложка для строк списка (или заглушка с нотой).
 * Картинка грузится отдельным кэшируемым запросом, а не инлайном в HTML.
 */
export function SongThumb({
  songId,
  hasCover,
  updatedAt,
}: {
  songId: string;
  hasCover?: boolean;
  updatedAt?: Date | string | number;
}) {
  if (hasCover && updatedAt) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={coverSrc(songId, updatedAt, 'sm')}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        className="cover cover-sm"
      />
    );
  }
  return (
    <div className="cover cover-sm cover-empty" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
  );
}
