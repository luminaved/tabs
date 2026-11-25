/** Текст подсказки — один на все места, где показывается галочка. */
export const VERIFIED_TITLE = 'Правильный подбор по мнению модератора';

/**
 * Жёлтая галочка подтверждённого разбора.
 *
 * Подсказка — свой блок в оформлении сайта, а не нативный `title`: тот
 * появляется с задержкой в полсекунды и рисуется системным стилем. Здесь она
 * всплывает над галочкой мгновенно (без задержки и анимации) — см. `.verified-tip`.
 * Разметка остаётся серверной: показ целиком на CSS, без состояния и JS.
 *
 * `aria-label` на обёртке оставлен для скринридеров, `role="img"` — чтобы
 * галочка читалась как значок, а не как декоративный кружок.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <span className="verified-badge shrink-0" role="img" aria-label={VERIFIED_TITLE} tabIndex={0}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {/* Круг с галочкой: узнаётся как «проверено» без подписи */}
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.6 5.6a1 1 0 0 1-1.4 0l-2.4-2.4a1 1 0 1 1 1.4-1.4l1.7 1.7 4.9-4.9a1 1 0 1 1 1.4 1.4Z" />
      </svg>
      <span className="verified-tip" aria-hidden>
        {VERIFIED_TITLE}
      </span>
    </span>
  );
}
