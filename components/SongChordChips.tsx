import { CapoIcon } from './CapoIcon';

const MAX = 16;

/**
 * Чипы аккордов песни (в порядке первого появления) для строки списка.
 *
 * Готовый список приходит пропом, а не считается здесь из текста песни:
 * строки каталога уезжают на клиент при подгрузке следующей порции, и весь
 * текст ради этих подписей пересылать незачем (см. `withChordChips`).
 *
 * Каподастр стоит ПЕРВЫМ чипом, если он есть. Отдельной подписи ему в строке
 * списка не хватило бы места, а знать о нём надо до того, как смотреть на
 * аккорды: он относится ко всем сразу.
 */
export function SongChordChips({ chords, capo = 0 }: { chords: string[]; capo?: number }) {
  const withCapo = capo > 0;
  if (chords.length === 0 && !withCapo) return null;

  const shown = chords.slice(0, MAX);
  const rest = chords.length - shown.length;

  return (
    <div className="hidden max-w-[45%] flex-wrap justify-end gap-1 sm:flex">
      {withCapo ? (
        <span className="chip-sm chip-sm--capo" title={`Каподастр на ${capo} ладу`}>
          <CapoIcon size={12} />
          {capo}
        </span>
      ) : null}
      {shown.map((c, i) => (
        <span key={`${c}-${i}`} className="chip-sm">
          {c}
        </span>
      ))}
      {rest > 0 ? <span className="chip-sm chip-sm--more">+{rest}</span> : null}
    </div>
  );
}
