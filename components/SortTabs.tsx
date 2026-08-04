import Link from 'next/link';
import { catalogHref, type SongSort } from '@/lib/catalogUrl';

const TABS: { value: SongSort; label: string }[] = [
  { value: 'new', label: 'Новые' },
  { value: 'views', label: 'Популярные' },
  { value: 'likes', label: 'По лайкам' },
];

/**
 * Компактная сортировка каталога — ссылки (работает без JS). Поиск и отбор
 * подтверждённых переносятся: смена порядка не должна сбрасывать то, что
 * человек уже выбрал.
 */
export function SortTabs({
  sort,
  query,
  verified,
  basePath = '/',
}: {
  sort: SongSort;
  query?: string;
  verified?: boolean;
  /** Каталог, внутри которого сортируем: «/» (гитара) или «/ukulele». */
  basePath?: string;
}) {
  const href = (value: SongSort) => catalogHref(basePath, { query, sort: value, verified });

  return (
    <div className="sort-tabs" role="group" aria-label="Сортировка">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={href(t.value)}
          className={t.value === sort ? 'sort-tab sort-tab--on' : 'sort-tab'}
          aria-current={t.value === sort ? 'true' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
