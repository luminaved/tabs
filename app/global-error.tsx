'use client';

import { useEffect } from 'react';

/**
 * Последний рубеж: ошибка в самом корневом layout, когда обычная граница
 * (app/(site)/error.tsx) отрисоваться уже не может. Next заменяет здесь весь
 * документ, поэтому `<html>` и `<body>` приходится писать самим.
 *
 * Стили — инлайном, без globals.css и без шрифтов из next/font: и то и другое
 * подключает корневой layout, а он к этому моменту как раз и не отработал.
 * Цвета продублированы значениями из :root — на экране, который показывают раз
 * в никогда, надёжность важнее переиспользования.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0e0d0b',
          color: '#ece8e0',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.75rem', fontWeight: 500 }}>
            Сайт временно недоступен
          </h1>
          <p style={{ margin: '0 0 1.75rem', color: '#968f81', lineHeight: 1.6 }}>
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#e6a23c',
              color: '#1a1408',
              border: 0,
              borderRadius: '0.5rem',
              padding: '0.65rem 1.35rem',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
          {error.digest ? (
            <p style={{ margin: '1.5rem 0 0', fontSize: '0.85rem', color: '#6b6459' }}>
              Код ошибки: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
