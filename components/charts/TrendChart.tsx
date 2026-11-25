import type { DayPoint } from '@/lib/stats';

/**
 * Ряд по дням — площадь с линией сверху.
 *
 * Серверный SVG без библиотек и без клиентского JS: страница открывается редко
 * и одним человеком, тянуть ради неё пакет графиков и гидратировать компонент
 * незачем.
 *
 * Серия одна, поэтому цвет — акцент темы, а легенда не нужна: её роль играет
 * заголовок. Значения не подписаны у каждой точки (это был бы шум) — крайние и
 * максимум подписаны, остальное читается по оси, всплывающей подсказке <title>
 * и таблице под графиком.
 */

const W = 700;
const H = 150;
// Под подписи оси значений. С запасом: на узком экране кегль подписей задан в
// единицах viewBox крупнее (иначе после сжатия он превращается в нечитаемые
// 4px — см. globals.css), и вместе с кеглем растёт ширина числа.
const PAD_L = 40;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 22; // под подписи дат — иначе ось обрезается

/** Короткая подпись даты: «7 фев». */
function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getUTCMonth()]}`;
}

/** Короткая запись числа для оси: 1200 → «1,2k». Длинное число не влезает. */
function tickLabel(v: number): string {
  if (v < 1000) return String(v);
  const k = v / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1).replace('.', ',')}k`;
}

/** Круглый потолок оси, чтобы подписи были «10/20», а не «13/26». */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * pow;
    if (candidate >= value) return candidate;
  }
  return 10 * pow;
}

export function TrendChart({
  points,
  title,
  caption,
  total,
}: {
  points: DayPoint[];
  title: string;
  caption?: string;
  /** Итог за период — выносится числом, чтобы график не пришлось суммировать глазами. */
  total: number;
}) {
  // Пустой ряд рисовать нечем: дальше идут points[0], points.length - 1 и
  // свёртка к максимуму — на пустом массиве это не «пустой график», а падение
  // страницы. Сейчас сюда всегда приходит ровно TREND_DAYS точек (fillDays
  // достраивает отрезок целиком), так что ветка холостая, — но она стоит между
  // «компонент переиспользовали с другим источником» и белым экраном.
  if (points.length === 0) {
    return (
      <figure className="chart-card">
        <figcaption className="chart-head">
          <span className="chart-title">{title}</span>
        </figcaption>
        <p className="text-sm text-muted">Пока пусто.</p>
      </figure>
    );
  }

  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const x = (i: number) =>
    PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`;

  // Подписываем выборочно: максимум ряда. Если он в нуле — не подписываем вовсе.
  const peakIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const peak = points[peakIndex];

  const gridValues = [0, max / 2, max];

  return (
    <figure className="chart-card">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-total">{total.toLocaleString('ru-RU')}</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`${title}: ${total} за ${points.length} дней`}
      >
        {/* Сетка — сплошные волосяные линии на тон от подложки, без пунктира */}
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD_L - 6} y={y(v) + 3.5} className="chart-tick" textAnchor="end">
              {tickLabel(v)}
            </text>
          </g>
        ))}

        <path d={area} className="chart-area" />
        <path d={line} className="chart-line" />

        {peak.value > 0 ? (
          <>
            <circle cx={x(peakIndex)} cy={y(peak.value)} r={3.5} className="chart-peak-dot" />
            <text
              x={Math.min(x(peakIndex), W - PAD_R - 14)}
              y={Math.max(y(peak.value) - 8, PAD_T + 8)}
              className="chart-peak-label"
              textAnchor="middle"
            >
              {peak.value}
            </text>
          </>
        ) : null}

        {/* Прозрачные полосы под курсор: подсказка на каждый день без JS.
            Ширина — на весь шаг, чтобы не приходилось целиться в точку. */}
        {points.map((p, i) => (
          <rect
            key={p.day}
            x={x(i) - innerW / points.length / 2}
            y={PAD_T}
            width={innerW / points.length}
            height={innerH}
            fill="transparent"
          >
            <title>{`${dayLabel(p.day)} — ${p.value}`}</title>
          </rect>
        ))}

        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} className="chart-axis" />
        <text x={PAD_L} y={H - 6} className="chart-tick">
          {dayLabel(points[0].day)}
        </text>
        <text x={W - PAD_R} y={H - 6} className="chart-tick" textAnchor="end">
          {dayLabel(points[points.length - 1].day)}
        </text>
      </svg>

      {caption ? <p className="chart-caption">{caption}</p> : null}

      {/* Таблица-двойник: значения доступны без наведения и без цвета. */}
      <details className="chart-table">
        <summary>Показать числа</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">День</th>
              <th scope="col">Значение</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <th scope="row">{dayLabel(p.day)}</th>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
