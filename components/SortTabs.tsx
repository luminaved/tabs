import Link from 'next/link';
import { catalogHref, type SongSort } from '@/lib/catalogUrl';

const TABS: { value: SongSort; label: string }[] = [
  { value: 'new', label: 'Новые' },
  { value: 'views', label: 'Популярные' },
  // «Лайки», а не «По лайкам»: ряд прокручивается вбок, и каждое лишнее слово
  // — это лишний жест пальцем, чтобы добраться до отбора справа.
  { value: 'likes', label: 'Лайки' },
];

/**
 * Сортировка каталога — ссылки (работает без JS). Поиск и отбор подтверждённых
 * переносятся: смена порядка не должна сбрасывать то, что человек уже выбрал.
 *
 * Своей обёртки у компонента НЕТ намеренно: пункты встают прямо в общий ряд
 * (см. FilterBar) рядом с отбором подтверждённых. Раньше здесь
 * был свой поддон с рамкой, а отбор жил отдельной кнопкой под ним — на телефоне
 * это два этажа интерфейса до первой песни.
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
    <>
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={href(t.value)}
          className={t.value === sort ? 'filter-tab filter-tab--on' : 'filter-tab'}
          aria-current={t.value === sort ? 'true' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </>
  );
}
