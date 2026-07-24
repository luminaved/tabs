'use client';

import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { resizeToDataUrl } from '@/lib/resizeImage';

/**
 * Аватар с загрузкой: при наведении показываются карандаш (изменить) и крестик
 * (убрать). Файл сжимается на клиенте в data URL (поле `image`).
 */
export function AvatarInput({
  initial,
  name,
  email,
  size = 96,
}: {
  initial?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const [image, setImage] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      setImage(await resizeToDataUrl(file, 256, 0.85));
    } catch {
      /* оставляем текущий аватар */
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="avatar-edit" style={{ width: size, height: size }}>
        <Avatar image={image || null} name={name} email={email} size={size} />
        <div className="avatar-overlay">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="avatar-overlay-btn"
            title="Изменить фото"
            aria-label="Изменить фото"
            disabled={busy}
          >
            <PencilIcon />
          </button>
          {image ? (
            <button
              type="button"
              onClick={() => setImage('')}
              className="avatar-overlay-btn"
              title="Убрать фото"
              aria-label="Убрать фото"
            >
              <CrossIcon />
            </button>
          ) : null}
        </div>
      </div>

      <input type="hidden" name="image" value={image} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
