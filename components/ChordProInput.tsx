'use client';

import { forwardRef, useRef, type UIEvent } from 'react';

// ── Подсветка ChordPro ──────────────────────────────────────────────────────
// Техника: прозрачный textarea поверх подсвеченной подложки-<pre> с идентичной
// метрикой (шрифт, размер, отступы, перенос). Подложка скроллится синхронно.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Токены: [аккорд], {директива}, %серый текст%.
const TOKEN = /(\[[^\]\n]*\])|(\{[^}\n]*\})|(%[^%\n]*%)/g;

function highlight(text: string): string {
  let html = '';
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    html += escapeHtml(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      const inner = tok.slice(1, -1);
      html += `<span class="cp-b">[</span><span class="cp-chord">${escapeHtml(inner)}</span><span class="cp-b">]</span>`;
    } else if (m[2]) {
      html += `<span class="cp-dir">${escapeHtml(tok)}</span>`;
    } else {
      const inner = tok.slice(1, -1);
      html += `<span class="cp-pct">%</span><span class="cp-muted">${escapeHtml(inner)}</span><span class="cp-pct">%</span>`;
    }
    last = m.index + tok.length;
  }
  html += escapeHtml(text.slice(last));
  // Хвостовой перенос: чтобы высота подложки совпадала с textarea, добавляем
  // «лишнюю» пустую строку (браузер иначе схлопывает последний \n).
  return html + '\n';
}

export const ChordProInput = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onScroll?: (e: UIEvent<HTMLTextAreaElement>) => void;
    className?: string;
    name?: string;
    spellCheck?: boolean;
  }
>(function ChordProInput({ value, onChange, onScroll, className, name, spellCheck = false }, ref) {
  const backdropRef = useRef<HTMLPreElement>(null);

  const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (backdropRef.current) {
      backdropRef.current.scrollTop = ta.scrollTop;
      backdropRef.current.scrollLeft = ta.scrollLeft;
    }
    onScroll?.(e);
  };

  return (
    <div className="cp-input">
      <pre className="cp-hl" aria-hidden ref={backdropRef} dangerouslySetInnerHTML={{ __html: highlight(value) }} />
      <textarea
        ref={ref}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={spellCheck}
        className={`cp-ta ${className ?? ''}`}
      />
    </div>
  );
});
