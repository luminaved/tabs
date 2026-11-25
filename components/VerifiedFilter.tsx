import Link from 'next/link';
import { catalogHref } from '@/lib/catalogUrl';
import { VERIFIED_TITLE } from './VerifiedBadge';

/**
 * Отбор «только подтверждённые». Как сортировка — обычная ссылка-переключатель:
 * работает без JS, состояние видно в адресе и им можно поделиться. Повторный
 * клик снимает отбор (ссылка ведёт на тот же каталог без параметра).
 *
 * Стоит последним пунктом в общей ленте с сортировкой (см. CatalogView) и
 * выглядит так же, отличаясь только краской во включённом состоянии — она
 * совпадает с галочкой в строках списка. Подпись сокращена до «Проверенные»:
 * в ленте, которая на телефоне прокручивается вбок, каждое слово занимает
 * место, а прежнее «Только подтверждённые» съедало её половину.
 */
export function VerifiedFilter({
  on,
  query,
  sort,
  basePath = '/',
}: {
  on: boolean;
  query?: string;
  sort?: string;
  basePath?: string;
}) {
  return (
    <Link
      href={catalogHref(basePath, { query, sort, verified: !on })}
      className={
        on ? 'filter-tab filter-tab--verified filter-tab--on' : 'filter-tab filter-tab--verified'
      }
      aria-pressed={on}
      title={on ? 'Показать все разборы' : VERIFIED_TITLE}
    >
      <CheckCircleIcon />
      Проверенные
    </Link>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.6 5.6a1 1 0 0 1-1.4 0l-2.4-2.4a1 1 0 1 1 1.4-1.4l1.7 1.7 4.9-4.9a1 1 0 1 1 1.4 1.4Z" />
    </svg>
  );
}
