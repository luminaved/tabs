/**
 * Доли целого одной горизонтальной полосой (видимость разборов).
 *
 * Части упорядочены по «открытости»: публичные → по ссылке → приватные. Порядок
 * настоящий, поэтому и краска — порядковая шкала одного тона, от светлого к
 * тёмному, а не набор разных цветов. Разные цвета намекали бы, что категории
 * равноправны и несопоставимы, — здесь это не так.
 *
 * Шкала проверена скриптом валидации на поверхности карточки: монотонная по
 * светлоте, шаги различимы, тёмный конец держит контраст к подложке.
 *
 * Сегменты разделены зазором в цвет подложки, а не обводкой: обводка утолщает
 * марку и на узких долях съедает саму долю.
 */

export interface Share {
  key: string;
  label: string;
  value: number;
}

/**
 * Доля процентом. Ненулевая величина, округляющаяся в ноль, пишется как «<1%»:
 * марку мы всё равно рисуем видимой (иначе доля пропала бы совсем), и подпись
 * «0%» рядом с видимой полоской противоречила бы сама себе.
 */
function percentLabel(value: number, total: number): string {
  if (total === 0 || value === 0) return '0%';
  const pct = (value / total) * 100;
  if (pct < 0.5) return '<1%';
  return `${Math.round(pct)}%`;
}

export function ShareBar({ title, parts }: { title: string; parts: Share[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);

  return (
    <figure className="chart-card">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-total">{total.toLocaleString('ru-RU')}</span>
      </figcaption>

      {total === 0 ? (
        <p className="text-sm text-muted">Пока пусто.</p>
      ) : (
        <>
          <div className="share-bar" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
            {parts.map((p, i) =>
              p.value > 0 ? (
                <div
                  key={p.key}
                  className={`share-seg share-seg--${i + 1}`}
                  style={{ flexGrow: p.value }}
                  title={`${p.label} — ${p.value}`}
                />
              ) : null,
            )}
          </div>

          {/* Легенда обязательна: долей больше одной, и цвет не должен быть
              единственным ключом. Числа и проценты — прямо в ней. */}
          <ul className="share-legend">
            {parts.map((p, i) => (
              <li key={p.key}>
                <span className={`share-dot share-seg--${i + 1}`} aria-hidden />
                <span className="share-legend-label">{p.label}</span>
                <span className="share-legend-value">
                  {p.value.toLocaleString('ru-RU')}
                  <span className="share-legend-pct"> {percentLabel(p.value, total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}

/**
 * Одна доля против целого — «сколько разборов подтверждено». Для такой задачи
 * это мера, а не диаграмма: две категории на круговой были бы худшим вариантом.
 */
export function Meter({
  label,
  value,
  total,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  hint?: string;
}) {
  const pct = total === 0 ? 0 : (value / total) * 100;
  const shown = percentLabel(value, total);
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          {shown}
          <span className="meter-abs">
            {' '}
            · {value.toLocaleString('ru-RU')} из {total.toLocaleString('ru-RU')}
          </span>
        </span>
      </div>
      <div className="bar-track" role="img" aria-label={`${label}: ${value} из ${total}, ${shown}`}>
        {/* Ненулевая доля рисуется хотя бы ниткой: иначе «1 из 1000» выглядел бы
            как ровный ноль, а это разные вещи. */}
        <div className="bar-fill" style={{ width: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }} />
      </div>
      {hint ? <p className="meter-hint">{hint}</p> : null}
    </div>
  );
}
