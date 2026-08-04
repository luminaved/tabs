'use client';

import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { resizeToDataUrl } from '@/lib/resizeImage';

/**
 * Аватар с загрузкой: при наведении показываются карандаш (изменить) и крестик
 * (убрать). Файл сжимается на клиенте в data URL.
 *
 * Поле `image` уходит на сервер, ТОЛЬКО если картинку сейчас трогали. Раньше оно
 * стояло в форме всегда и было заполнено текущим аватаром: страница кабинета
 * тащила из базы весь data URL (до 17 КБ), вписывала его в разметку и получала
 * обратно при каждом сохранении — даже когда меняли одно имя. Теперь показ идёт
 * ссылкой на /avatars/[id] (как в шапке и везде), а поле появляется только
 * вместе с изменением; его отсутствие сервер читает как «не трогать»
 * (см. app/(site)/account/actions.ts).
 */
export function AvatarInput({
  userId,
  version,
  name,
  email,
  size = 96,
}: {
  userId: string;
  /** Отпечаток сохранённой картинки; null — аватара нет. */
  version: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  // null — картинку не меняли; строка — выбрали новую; '' — попросили убрать.
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setFailed(false);
    try {
      setNext(await resizeToDataUrl(file, 256, 0.85));
    } catch {
      // Молча оставлять прежний аватар нельзя: снаружи это выглядит как
      // «кнопка не работает». Тот же случай, что и у обложки (CoverInput) —
      // чаще всего HEIC с айфона, который браузер не декодирует.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // Что показываем: свежий файл — напрямую (в базе его ещё нет), иначе —
  // сохранённый по ссылке. Убранный не показываем вовсе: останется инициал.
  const showSaved = next === null && !!version;
  const canRemove = next === null ? !!version : next !== '';

  return (
    <>
      <div className="avatar-edit" style={{ width: size, height: size }}>
        <Avatar
          image={next || null}
          version={showSaved ? version : null}
          userId={showSaved ? userId : null}
          name={name}
          email={email}
          size={size}
        />
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
          {canRemove ? (
            <button
              type="button"
              onClick={() => setNext('')}
              className="avatar-overlay-btn"
              title="Убрать фото"
              aria-label="Убрать фото"
            >
              <CrossIcon />
            </button>
          ) : null}
        </div>
      </div>

      {failed ? (
        <p className="text-sm text-red-300" role="alert">
          Не удалось прочитать этот файл. Подойдут JPEG, PNG или WebP.
        </p>
      ) : null}

      {next === null ? null : <input type="hidden" name="image" value={next} />}
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
