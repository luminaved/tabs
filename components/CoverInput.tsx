'use client';

import { useRef, useState } from 'react';
import { resizeToDataUrl } from '@/lib/resizeImage';

/**
 * Загрузка обложки: файл сжимается на клиенте (canvas, макс. 512px, JPEG)
 * в data URL и кладётся в скрытый инпут `coverUrl` — хранится прямо в БД,
 * без внешнего хранилища.
 */
export function CoverInput({ initial }: { initial?: string | null }) {
  const [cover, setCover] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      setCover(await resizeToDataUrl(file, 512, 0.82));
    } catch {
      /* игнорируем — оставляем текущую обложку */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="Обложка" className="cover cover-lg" />
      ) : (
        <div className="cover cover-lg cover-empty">
          <MusicIcon />
        </div>
      )}

      <input type="hidden" name="coverUrl" value={cover} />

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn btn-outline h-9 px-3 text-sm"
        >
          {busy ? '…' : cover ? 'Заменить' : 'Загрузить обложку'}
        </button>
        {cover ? (
          <button
            type="button"
            onClick={() => setCover('')}
            className="btn btn-ghost h-9 px-2 text-sm"
          >
            Убрать
          </button>
        ) : null}
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
      </div>
    </div>
  );
}

function MusicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
