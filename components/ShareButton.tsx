'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * «Поделиться»: на телефоне — системное меню (Web Share API), на десктопе —
 * копирование ссылки с подтверждением. Ссылка абсолютная, чтобы её можно было
 * сразу вставить в мессенджер.
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    // На телефоне — системное меню «Поделиться»; на десктопе его нет, поэтому
    // там просто копируем ссылку и подтверждаем это самой кнопкой.
    const canNativeShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      // Системное меню уместно только на сенсорных устройствах: в десктопных
      // браузерах оно либо отсутствует, либо открывает лишний диалог.
      window.matchMedia('(pointer: coarse)').matches;

    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Пользователь закрыл системное меню — просто ничего не делаем.
        return;
      }
    }

    if (await copyToClipboard(url)) flash();
    else window.prompt('Скопируйте ссылку:', url); // совсем крайний случай
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`btn btn-share h-9 gap-1.5 px-3 text-sm ${copied ? 'btn-copied' : 'btn-outline'}`}
      title="Поделиться разбором"
      aria-live="polite"
    >
      <span className="share-swap">
        {copied ? <CheckIcon /> : <ShareIcon />}
        <span className="hidden sm:inline">{copied ? 'Скопировано!' : 'Поделиться'}</span>
      </span>
    </button>
  );
}

/**
 * Копирование с запасным путём. navigator.clipboard требует https и фокуса на
 * документе — если он откажет, пробуем старый execCommand через невидимое поле.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* пробуем запасной путь ниже */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
