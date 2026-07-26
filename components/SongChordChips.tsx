const MAX = 16;

/**
 * Чипы аккордов песни (в порядке первого появления) для строки списка.
 *
 * Готовый список приходит пропом, а не считается здесь из текста песни:
 * строки каталога уезжают на клиент при подгрузке следующей порции, и весь
 * текст ради этих подписей пересылать незачем (см. `withChordChips`).
 */
export function SongChordChips({ chords }: { chords: string[] }) {
  if (chords.length === 0) return null;

  const shown = chords.slice(0, MAX);
  const rest = chords.length - shown.length;

  return (
    <div className="hidden max-w-[45%] flex-wrap justify-end gap-1 sm:flex">
      {shown.map((c, i) => (
        <span key={`${c}-${i}`} className="chip-sm">
          {c}
        </span>
      ))}
      {rest > 0 ? <span className="chip-sm chip-sm--more">+{rest}</span> : null}
    </div>
  );
}
