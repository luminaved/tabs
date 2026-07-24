'use client';

import { useState } from 'react';

const OPTIONS = [
  { value: 'public', label: 'Публичная', desc: 'видна в каталоге', Icon: GlobeIcon },
  { value: 'unlisted', label: 'По ссылке', desc: 'кто угодно со ссылкой', Icon: LinkIcon },
  { value: 'private', label: 'Приватная', desc: 'только вы', Icon: LockIcon },
] as const;

export function VisibilitySelect({ initial }: { initial?: string }) {
  // Для новых песен по умолчанию — публичная.
  const [value, setValue] = useState(initial ?? 'public');

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {OPTIONS.map(({ value: v, label, desc, Icon }) => (
        <label key={v} className={v === value ? 'vis-card vis-card--on' : 'vis-card'}>
          <input
            type="radio"
            name="visibility"
            value={v}
            checked={v === value}
            onChange={() => setValue(v)}
            className="sr-only"
          />
          <Icon />
          <span className="vis-card-label">{label}</span>
          <span className="vis-card-desc">{desc}</span>
        </label>
      ))}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
