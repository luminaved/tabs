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
    // Размер обложки задаёт ширина столбца в шапке редактора, высоту она берёт
    // из своей пропорции 1:1 — тянуть этот блок по высоте ряда не нужно.
    <div className="flex flex-col gap-2">
      {/* Карандаш и крестик поверх картинки — тот же приём, что у аватара в
          кабинете (AvatarInput), вплоть до общих правил в globals.css. */}
      <div className={previewSrc ? 'cover-edit' : 'cover-edit cover-edit--empty'}>
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="Обложка" className="cover-edit-img" />
        ) : (
          <div className="cover-edit-empty">
            <MusicIcon />
          </div>
        )}

        <div className="cover-edit-overlay">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="cover-edit-btn"
            title={previewSrc ? 'Заменить обложку' : 'Загрузить обложку'}
            aria-label={previewSrc ? 'Заменить обложку' : 'Загрузить обложку'}
          >
            <PencilIcon />
          </button>
          {previewSrc ? (
            <button
              type="button"
              onClick={() => setCover('')}
              className="cover-edit-btn"
              title="Убрать обложку"
              aria-label="Убрать обложку"
            >
              <CrossIcon />
            </button>
          ) : null}
        </div>
      </div>

      <input type="hidden" name="coverUrl" value={cover} />
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

      {failed ? (
        <p className="text-xs text-red-300" role="alert">
          Не удалось прочитать этот файл. Браузер понимает JPEG, PNG и WebP —
          фотографии с айфона (HEIC) нужно сначала сохранить в JPEG.
        </p>
      ) : null}
    </div>
  );
}

/* Карандаш и крестик повторяют значки из AvatarInput: это одно и то же действие
   в двух местах, и выглядеть оно обязано одинаково. Общего модуля значков в
   проекте нет — каждый компонент держит свои, — поэтому пути продублированы. */
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

function MusicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
