'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { getChordShape, type ChordShape } from '@/lib/chords/diagrams';
import type { InstrumentId } from '@/lib/chords/instruments';

/**
 * Аккорд в тексте: при наведении (мышь) или нажатии всплывает аппликатура.
 *
 * ── Почему наведение отделено от нажатия ────────────────────────────────────
 *
 * Раньше здесь стояли `onMouseEnter`/`onMouseLeave` вместе с `onClick`, и на
 * телефоне это давало ровно противоположный эффект. Мобильные браузеры на
 * ПЕРВОМ касании эмулируют мышь: сначала приходит `mouseenter` (аппликатура
 * открывается), сразу за ним — `click`, который её же и закрывал. То есть с
 * первого тапа аппликатура не показывалась вовсе и начинала работать лишь со
 * второго, когда `mouseenter` уже не повторялся.
 *
 * Указательные события такое различают сами: `pointerType` говорит, чем ткнули.
 * Наведение оставляем мыши, касанию и перу — нажатие.
 *
 * ── Почему клик не всплывает ────────────────────────────────────────────────
 *
 * У владельца разбора строка песни кликабельна целиком (к ней добавляется
 * заметка, см. ChordSheet). Без `stopPropagation` нажатие на аккорд заодно
 * открывало форму заметки — то есть посмотреть аппликатуру в своём разборе
 * было нельзя, не поймав каждый раз лишнюю форму.
 */
export function InlineChord({
  name,
  instrument,
  customDefs,
}: {
  name: string;
  instrument?: InstrumentId | null;
  customDefs?: Record<string, ChordShape>;
}) {
  const [open, setOpen] = useState(false);
  const shape = getChordShape(name, instrument ?? null, customDefs);

  // Показывать нечего — оставляем простым текстом. Иначе аккорд без формы
  // («N.C.», незнакомая запись) становился бы точкой остановки табуляции,
  // которая ничего не делает.
  if (!shape) return <span className="inline-chord">{name}</span>;

  const toggle = () => setOpen((o) => !o);

  const onPointerEnter = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === 'mouse') setOpen(true);
  };
  const onPointerLeave = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === 'mouse') setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Пробел иначе прокручивает страницу из-под только что открытой картинки.
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <span
      className="inline-chord"
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`Аппликатура ${name}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onKeyDown={onKeyDown}
      onBlur={() => setOpen(false)}
    >
      {name}
      {open ? (
        <span className="chord-pop">
          <ChordDiagram frets={shape.frets} barres={shape.barres} name={name} size={84} />
          <span className="chord-pop-name">{name}</span>
        </span>
      ) : null}
    </span>
  );
}
