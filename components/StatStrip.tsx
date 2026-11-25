import { compactRu, pluralRu } from '@/lib/plural';
import type { UserStats } from '@/lib/stats';

/**
 * Счётчики автора строкой: разборы, подтверждённые, просмотры.
 *
 * Стоит на публичном профиле и в личном кабинете. Числа там считаются по-разному
 * (чужому видны только публичные разборы — см. `getUserStats`), но показываются
 * одинаково: это одна и та же справка о том, сколько человек написал и сколько
 * это прочитали.
 *
 * Ничего не решает про пустоту: страница сама знает, показывать ли полосу.
 * «0 разборов · 0 подтверждено · 0 просмотров» — не сводка, а три нуля на месте,
 * где у нового автора и так стоит человеческое объяснение.
 */
export function StatStrip({ stats, className }: { stats: UserStats; className?: string }) {
  return (
    <dl className={className ? `stat-strip ${className}` : 'stat-strip'}>
      {/* Подпись идёт ПЕРЕД числом: в <dl> порядок «dt, dd» обязателен, а наверх
          число поднимает CSS (column-reverse). Читалке от этого только лучше —
          она произносит «разборов: 52», а не наоборот. */}
      <div className="stat-strip-item">
        <dt className="stat-strip-label">
          {pluralRu(stats.songs, 'разбор', 'разбора', 'разборов')}
        </dt>
        <dd className="stat-strip-value">{compactRu(stats.songs)}</dd>
      </div>
      <div className="stat-strip-item">
        <dt className="stat-strip-label">подтверждено</dt>
        <dd className="stat-strip-value">{compactRu(stats.verified)}</dd>
      </div>
      <div className="stat-strip-item">
        <dt className="stat-strip-label">
          {pluralRu(stats.views, 'просмотр', 'просмотра', 'просмотров')}
        </dt>
        <dd className="stat-strip-value">{compactRu(stats.views)}</dd>
      </div>
    </dl>
  );
}
