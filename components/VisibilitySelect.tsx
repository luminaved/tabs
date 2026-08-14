'use client';

import { useState } from 'react';

const OPTIONS = [
  { value: 'public', label: 'Публичная', desc: 'видна в каталоге', Icon: GlobeIcon },
  { value: 'unlisted', label: 'По ссылке', desc: 'кто угодно со ссылкой', Icon: LinkIcon },
  { value: 'private', label: 'Приватная', desc: 'только вы', Icon: LockIcon },
] as const;

/**
 * Видимость разбора — сегментированный переключатель.
 *
 * Раньше это были три карточки с подписью и пояснением в каждой, и на телефоне
 * они вставали ДРУГ ПОД ДРУГА: почти треть экрана на выбор из трёх слов, в
 * самом низу длинной формы. Теперь варианты стоят в ряд, а пояснение остаётся
 * одно — к выбранному. Всё, что было написано, никуда не делось: три
 * одновременных пояснения читают ровно один раз, а место они занимали всегда.
 */
export function VisibilitySelect({ initial }: { initial?: string }) {
  // Для новых песен по умолчанию — публичная.
  const [value, setValue] = useState(initial ?? 'public');
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <div>
      {/* Роль radiogroup не ставим: внутри настоящие <input type="radio"> с общим
          именем, и браузер сам считает их группой — со стрелками на клавиатуре
          и переносом значения в форму. */}
      <div className="seg">
        {OPTIONS.map(({ value: v, label, Icon }) => (
          <label key={v} className={v === value ? 'seg-item seg-item--on' : 'seg-item'}>
            <input
              type="radio"
              name="visibility"
              value={v}
              checked={v === value}
              onChange={() => setValue(v)}
              className="sr-only"
            />
            <Icon />
            <span className="seg-item-label">{label}</span>
          </label>
        ))}
      </div>
      <p className="seg-desc">{current.desc}</p>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
