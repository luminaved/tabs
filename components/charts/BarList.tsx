import Link from 'next/link';

/**
 * Ранжированный список с полосами — «топ по просмотрам», «топ авторов».
 *
 * Раньше это был список с числами справа: чтобы понять, отрывается ли первый
 * от второго, приходилось вычитать в уме. Полоса показывает это сразу.
 *
 * Полосы одноцветные. Красить их по величине было бы двойным кодированием:
 * длина уже несёт ту же информацию, а цвет тогда не значит ничего нового.
 * Значение подписано у каждой строки, поэтому цвет ничего не решает в одиночку.
 */

export interface BarItem {
  id: string;
  label: string;
  /** Приписка к названию — исполнитель, второстепенная. */
  sub?: string | null;
  value: number;
  href?: string;
}

export function BarList({
  title,
  items,
  unit,
  empty = 'Пока пусто.',
}: {
  title: string;
  items: BarItem[];
  /** Что меряем — идёт в подсказку и в заголовок колонки таблицы. */
  unit: string;
  empty?: string;
}) {
  // Шкала от нуля до максимума: полосы сравниваются между собой, а не с общим
  // итогом, поэтому нормируем на первый — так разрыв виден в полную ширину.
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <figure className="chart-card">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-unit">{unit}</span>
      </figcaption>

      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ol className="bar-list">
          {items.map((item, i) => (
            <li key={item.id} className="bar-row">
              <span className="bar-rank">{i + 1}</span>
              <div className="bar-body">
                <div className="bar-labels">
                  {item.href ? (
                    <Link href={item.href} className="bar-label">
                      {item.label}
                      {item.sub ? <span className="bar-sub"> — {item.sub}</span> : null}
                    </Link>
                  ) : (
                    <span className="bar-label">
                      {item.label}
                      {item.sub ? <span className="bar-sub"> — {item.sub}</span> : null}
                    </span>
                  )}
                  <span className="bar-value">{item.value.toLocaleString('ru-RU')}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
