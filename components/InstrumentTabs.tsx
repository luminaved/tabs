import Link from 'next/link';
import { catalogHref } from '@/lib/catalogUrl';
import {
  INSTRUMENTS,
  INSTRUMENT_IDS,
  catalogPath,
  type InstrumentId,
} from '@/lib/chords/instruments';

/**
 * Переключатель каталогов: гитара ↔ укулеле. Обычные ссылки на отдельные
 * адреса (`/` и `/ukulele`), а не состояние на клиенте — так каждый каталог
 * индексируется и им можно поделиться. Поисковый запрос и отбор переносятся;
 * сортировка — нет, она у каждого каталога своя по смыслу выдачи.
 */
export function InstrumentTabs({
  current,
  query,
  verified,
}: {
  current: InstrumentId;
  query?: string;
  verified?: boolean;
}) {
  const href = (id: InstrumentId) => catalogHref(catalogPath(id), { query, verified });

  return (
    <div className="inst-tabs" role="group" aria-label="Инструмент">
      {INSTRUMENT_IDS.map((id) => (
        <Link
          key={id}
          href={href(id)}
          className={id === current ? 'inst-tab inst-tab--on' : 'inst-tab'}
          aria-current={id === current ? 'true' : undefined}
        >
          {INSTRUMENTS[id].name}
        </Link>
      ))}
    </div>
  );
}
