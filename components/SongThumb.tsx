import { coverSrc } from '@/lib/coverUrl';

/**
 * Сколько первых обложек в списке грузить сразу, без отложенной загрузки.
 *
 * `loading="lazy"` на картинке, которая и так видна с самого начала, — это не
 * экономия, а задержка: браузер узнаёт о её положении только после раскладки,
 * то есть после разбора и применения всех стилей, и лишь тогда начинает
 * качать. Для строк ниже сгиба это правильный размен, для первых — потеря.
 *
 * Четыре — оценка по высоте первого экрана телефона: шапка, заголовок, поиск и
 * вкладки съедают около 400 px, дальше идут строки по ~72 px. Число намеренно
 * скромное: ошибиться в меньшую сторону стоит одной поздней картинки, в
 * бо́льшую — лишнего трафика на каждой загрузке каталога.
 */
export const EAGER_THUMBS = 4;

/**
 * Маленькая обложка для строк списка (или заглушка с нотой).
 * Картинка грузится отдельным кэшируемым запросом, а не инлайном в HTML.
 */
export function SongThumb({
  songId,
  hasCover,
  updatedAt,
  priority = false,
}: {
  songId: string;
  hasCover?: boolean;
  updatedAt?: Date | string | number;
  /** Строка видна на первом экране — грузим сразу (см. EAGER_THUMBS). */
  priority?: boolean;
}) {
  if (hasCover && updatedAt) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={coverSrc(songId, updatedAt, 'sm')}
        alt=""
        width={56}
        height={56}
        loading={priority ? 'eager' : 'lazy'}
        // Обложки маленькие (1–3 КБ), но по умолчанию картинки идут в очереди
        // последними. Первым строкам это стоит заметной задержки на медленной
        // связи, поэтому им приоритет поднимаем, остальным — оставляем низкий.
        fetchPriority={priority ? 'high' : undefined}
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
