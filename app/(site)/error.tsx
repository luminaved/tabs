'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Непойманная ошибка в разделах сайта.
 *
 * Ближайший повод — удаление: `deleteSongAction` и `deleteAnnotationAction`
 * намеренно бросают, если удалить не вышло (иначе неудача выглядела бы удачей,
 * см. комментарии в самих экшенах). Но без этой границы бросок разворачивался в
 * стандартный экран Next, то есть «разбор не удалился» выглядело как «сайт
 * упал». Теперь это обычное сообщение с кнопкой повтора.
 *
 * Текст ошибки наружу не показываем: в проде Next и так заменяет его на digest,
 * а на сервере в сообщении легко оказывается лишнее. `error.digest` выводим —
 * по нему запись находится в логах.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // В консоль — целиком: в разработке это единственное место, где видно, что
    // именно произошло.
    console.error(error);
  }, [error]);

  return (
    <main className="container-app py-10">
      <div className="card px-6 py-16 text-center">
        <p className="eyebrow mb-2">Ошибка</p>
        <h1 className="display mb-3 text-3xl font-medium">Что-то пошло не так</h1>
        <p className="mx-auto mb-8 max-w-md text-muted">
          Действие не удалось выполнить. Попробуйте ещё раз — если повторяется,
          обновите страницу.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={reset} className="btn btn-primary h-10 px-5">
            Попробовать снова
          </button>
          <Link href="/" className="btn btn-outline h-10 px-5">
            На главную
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-sm text-faint">Код ошибки: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
