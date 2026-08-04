'use client';

import { useRef, useState } from 'react';
import { resizeToDataUrl } from '@/lib/resizeImage';
import { COVER_KEEP } from '@/lib/imageInput';

/**
 * Загрузка обложки: файл сжимается на клиенте (canvas, макс. 512px, JPEG) в
 * data URL и кладётся в скрытый инпут `coverUrl` — хранится прямо в БД, без
 * внешнего хранилища.
 *
 * Уже сохранённая обложка приходит ССЫЛКОЙ (`initialSrc` → /covers/[id]), а не
 * картинкой. Раньше сюда отдавали весь base64: он вшивался в HTML страницы
 * редактирования и уезжал обратно в POST при каждом сохранении — по живым
 * данным это 35 КБ в среднем и до 100 КБ в пике, туда и обратно, ради картинки,
 * которая и так лежит в базе неизменной.
 *
 * Поэтому в скрытом инпуте теперь не картинка, а состояние:
 *   `COVER_KEEP` — не трогали (сервер оставит, что было);
 *   `''`         — убрали;
 *   `data:…`     — выбрали новую.
 */
export function CoverInput({ initialSrc }: { initialSrc?: string | null }) {
  // Пришла ссылка на существующую обложку — значит трогать её пока не просили.
  const [cover, setCover] = useState(initialSrc ? COVER_KEEP : '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Что показываем: прежнюю обложку по ссылке либо только что выбранный файл.
  const previewSrc = cover === COVER_KEEP ? (initialSrc ?? null) : cover || null;

  const onFile = async (file: File) => {
    setBusy(true);
    setFailed(false);
    try {
      setCover(await resizeToDataUrl(file, 512, 0.82));
    } catch {
      // Раньше здесь стояло молчаливое «игнорируем», и это был самый заметный
      // способ выглядеть сломанным: человек выбирал файл, и НЕ ПРОИСХОДИЛО
      // ничего — ни картинки, ни ошибки. Чаще всего так ведёт себя HEIC с
      // айфона: браузер его не декодирует, `resizeToDataUrl` отваливается на
      // `img.onerror`, и обложка остаётся прежней без единого слова.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewSrc} alt="Обложка" className="cover cover-lg" />
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
          {busy ? '…' : previewSrc ? 'Заменить' : 'Загрузить обложку'}
        </button>
        {previewSrc ? (
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

      {failed ? (
        <p className="basis-full text-sm text-red-300" role="alert">
          Не удалось прочитать этот файл. Браузер понимает JPEG, PNG и WebP —
          фотографии с айфона (HEIC) нужно сначала сохранить в JPEG.
        </p>
      ) : null}
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
