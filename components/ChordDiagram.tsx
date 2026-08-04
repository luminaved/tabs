import type { Barre, ChordFrets } from '@/lib/chords/diagrams';

// Единицы viewBox: шаг между струнами и поля по краям.
const STRING_GAP = 8.8;

/**
 * Поля слева и справа от сетки. РАЗНЫЕ, и это не небрежность: слева живёт номер
 * начального лада, справа — ничего.
 *
 * Раньше поле было симметричным (9 и 9), и двузначный номер туда не влезал
 * физически. Просвет до первой точки — это не 9 единиц, а 9 минус её радиус
 * 3.4, то есть 5.6; «11» шрифтом 5.6 занимает 6.3 и налезало на точку. Сумма
 * полей осталась прежней (18), поэтому ширина холста, пропорции и все размеры
 * карточек не изменились — сетка лишь сдвинулась на две единицы вправо.
 */
const EDGE_LEFT = 12;
const EDGE_RIGHT = 6;

/** Радиус точки-пальца. Он же задаёт, где начинается «чернила» сетки слева. */
const DOT_R = 3.4;

/** Ширина шестиструнной диаграммы — эталон, к которому приводится `size`. */
const REFERENCE_W = EDGE_LEFT + EDGE_RIGHT + 5 * STRING_GAP;

/** Внутренняя ширина холста для N струн. */
function canvasWidth(strings: number): number {
  return EDGE_LEFT + EDGE_RIGHT + (strings - 1) * STRING_GAP;
}

/**
 * Ширина картинки в пикселях: `size` задаёт размер ШЕСТИСТРУННОЙ диаграммы,
 * а диаграмма с другим числом струн масштабируется пропорционально — чтобы шаг
 * между струнами был одинаковым у гитары и укулеле, а не растягивался.
 */
export function diagramWidth(strings: number, size: number): number {
  return (size * canvasWidth(strings)) / REFERENCE_W;
}

/** Высота картинки для заданной ширины (пропорции холста постоянны). */
export function diagramHeight(strings: number, size: number): number {
  return (diagramWidth(strings, size) * 74) / canvasWidth(strings);
}

/**
 * Диаграмма аккорда: N струн × 4 лада. Точки — прижатые струны, ○/× сверху —
 * открытая/заглушённая, палка — баррэ. Если аккорд высоко на грифе — подпись
 * начального лада.
 *
 * Число струн берётся из самой формы, поэтому один компонент рисует и гитару
 * (6), и укулеле (4). Ширина картинки подстраивается под число струн, чтобы
 * промежуток между ними оставался одинаковым на всех инструментах.
 */
export function ChordDiagram({
  frets,
  barres = [],
  name,
  size,
}: {
  frets: ChordFrets;
  barres?: Barre[];
  name?: string;
  /** Размер в пикселях по мерке шестиструнной диаграммы (см. `diagramWidth`). */
  size?: number;
}) {
  const FRETS = 4;
  const strings = Math.max(frets.length, 2);

  const positives = frets.filter((f) => f > 0);
  const maxFret = positives.length ? Math.max(...positives) : 0;
  const minFret = positives.length ? Math.min(...positives) : 0;
  const base = maxFret > FRETS ? minFret : 1; // окно грифа

  // Геометрия в единицах viewBox: шаг между струнами фиксирован, ширина
  // холста растёт от числа струн (у укулеле диаграмма уже гитарной).
  const left = EDGE_LEFT;
  const right = left + (strings - 1) * STRING_GAP;
  const top = 16;
  const bottom = 66;
  const W = canvasWidth(strings);
  const H = 74;
  const fretGap = (bottom - top) / FRETS;
  const x = (s: number) => left + s * STRING_GAP;
  const y = (f: number) => top + f * fretGap;

  const width = diagramWidth(strings, size ?? REFERENCE_W);

  return (
    <svg
      width={width}
      height={(width * H) / W}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={name ? `Аккорд ${name}` : 'Аккорд'}
    >
      {/* Порожек (только если играем от 1 лада) */}
      {base === 1 ? (
        <line x1={left} y1={top} x2={right} y2={top} stroke="currentColor" strokeWidth={3} />
      ) : (
        /*
          Номер лада — по центру ПРОСВЕТА слева от сетки. Просвет считается до
          края точки (`left - DOT_R`), а не до линии струны: точка выступает за
          неё на свой радиус, и именно на неё подпись наезжала, когда её
          центрировали по `left / 2`.

          До этого было ещё хуже: `x={left - 5}` с `textAnchor="end"` уводил
          текст за нулевую границу viewBox, а внешний <svg> обрезает всё за
          своими пределами — у двузначного лада пропадала первая цифра, «10»
          показывалось как «0».

          Двузначный номер вдвое шире, а просвет один и тот же, поэтому ему
          шрифт мельче.
        */
        <text
          x={(left - DOT_R) / 2}
          y={top + fretGap * 0.7}
          fontSize={base > 9 ? 5.4 : 7}
          textAnchor="middle"
          fill="currentColor"
          opacity="0.7"
        >
          {base}
        </text>
      )}

      {/* Лады */}
      {Array.from({ length: FRETS + 1 }).map((_, i) => (
        <line key={`f${i}`} x1={left} y1={y(i)} x2={right} y2={y(i)} stroke="currentColor" strokeWidth={0.8} opacity="0.35" />
      ))}
      {/* Струны */}
      {Array.from({ length: strings }).map((_, s) => (
        <line key={`s${s}`} x1={x(s)} y1={top} x2={x(s)} y2={bottom} stroke="currentColor" strokeWidth={0.8} opacity="0.35" />
      ))}

      {/* Баррэ — палка (под точками) */}
      {barres.map((b, i) => {
        const pos = b.fret - base + 1; // 1..FRETS
        if (pos < 1 || pos > FRETS) return null;
        const cy = y(pos) - fretGap / 2;
        const r = DOT_R;
        return (
          <rect
            key={`b${i}`}
            x={x(b.from) - r}
            y={cy - r}
            width={x(b.to) - x(b.from) + 2 * r}
            height={2 * r}
            rx={r}
            fill="var(--color-accent)"
          />
        );
      })}

      {frets.map((f, s) => {
        if (f === -1) {
          return (
            <text key={s} x={x(s)} y={top - 4} fontSize="8" textAnchor="middle" fill="currentColor" opacity="0.6">
              ×
            </text>
          );
        }
        if (f === 0) {
          return <circle key={s} cx={x(s)} cy={top - 6} r={2.6} fill="none" stroke="currentColor" strokeWidth={1} opacity="0.7" />;
        }
        const pos = f - base + 1; // 1..FRETS
        return <circle key={s} cx={x(s)} cy={y(pos) - fretGap / 2} r={DOT_R} fill="var(--color-accent)" />;
      })}
    </svg>
  );
}
