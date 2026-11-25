'use client';

import { useState } from 'react';

/**
 * Быстрая вставка аккордов: клик по чипу вставляет [Аккорд] в позицию курсора.
 * Избавляет от печати скобок и переключения раскладки.
 *
 * Показываются только аккорды, УЖЕ встречающиеся в тексте, — то есть повтор
 * того, что человек набрал сам. Подсказки по тональности («в Am играют Am, Dm,
 * E7…») здесь были и убраны: разбор пишут с конкретной песни, а не сочиняют по
 * теории, поэтому предложенное почти никогда не совпадало с нужным, но занимало
 * первую и самую заметную половину тулбара.
 */
export function ChordPalette({
  used,
  onInsert,
}: {
  used: string[];
  onInsert: (chord: string) => void;
}) {
  const [custom, setCustom] = useState('');

  const addCustom = () => {
    const c = custom.trim();
    if (c) {
      onInsert(c);
      setCustom('');
    }
  };

  return (
    // Один ряд с переносом: чипы и поле «свой» лежат в общем потоке и занимают
    // столько строк, сколько нужно, а разделитель показывает, где кончается
    // список аккордов и начинается ручной ввод.
    <div className="editor-toolbar">
      {used.length ? (
        <>
          <span className="editor-toolbar-label">В песне</span>
          {used.map((c) => (
            <button
              type="button"
              key={c}
              className="chip"
              // Гасим mousedown, иначе нажатие уводит фокус из textarea и
              // схлопывает выделение — а вставка идёт именно в него
              // (см. insertChord). Раньше это стояло только у половины чипов.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(c)}
            >
              {c}
            </button>
          ))}
          <span className="editor-toolbar-sep" aria-hidden />
        </>
      ) : null}

      {/* На телефоне поле уже, а подпись кнопки сжимается до «+»: вдвоём они
          занимали почти всю строку тулбара, то есть целый лишний ряд на экране,
          где каждый ряд на счету. Смысл читается из плейсхолдера рядом. */}
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustom();
          }
        }}
        placeholder="свой аккорд"
        aria-label="Свой аккорд"
        className="field h-7 w-24 px-2.5 text-sm sm:w-36"
      />
      <button
        type="button"
        className="btn btn-outline h-7 px-2.5 text-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={addCustom}
        title="Вставить в позицию курсора"
        aria-label="Вставить в позицию курсора"
      >
        <span className="sm:hidden" aria-hidden>
          +
        </span>
        <span className="hidden sm:inline" aria-hidden>
          Вставить
        </span>
      </button>
    </div>
  );
}
