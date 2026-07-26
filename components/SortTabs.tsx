import Link from 'next/link';
import type { SongSort } from '@/lib/songs';

const TABS: { value: SongSort; label: string }[] = [
  { value: 'new', label: 'Новые' },
  { value: 'views', label: 'Популярные' },
  { value: 'likes', label: 'По лайкам' },
];

/** Компактная сортировка каталога — ссылки (работает без JS, сохраняет поиск). */
export function SortTabs({ sort, query }: { sort: SongSort; query?: string }) {
  const href = (value: SongSort) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (value !== 'new') params.set('sort', value);
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

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
