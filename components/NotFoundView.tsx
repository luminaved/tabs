import Link from 'next/link';

/**
 * Тело страницы «не найдено» — общее для обоих уровней.
 *
 * Уровней два, потому что Next выбирает ближайшую границу: `app/not-found.tsx`
 * ловит несуществующие адреса вообще, а `app/(site)/not-found.tsx` — вызовы
 * `notFound()` из разделов сайта (удалённый или скрытый разбор, несуществующий
 * автор, `/admin` без прав). Разметка у них одна, отличается только шапка:
 * в группе `(site)` её рисует общий layout, на корневом уровне её приходится
 * ставить руками.
 *
 * До этого не было ни того ни другого, и человек, пришедший из поиска на
 * удалённый разбор, видел стандартный экран Next: «404 — This page could not be
 * found» по-английски посреди русского сайта и без единой ссылки дальше.
 * Статус 404 при этом отдавался правильный — чинить нужно было ровно вид.
 */
export function NotFoundView() {
  return (
    <main className="container-app py-10">
      <div className="card px-6 py-16 text-center">
        <p className="eyebrow mb-2">Ошибка 404</p>
        <h1 className="display mb-3 text-3xl font-medium">Страница не найдена</h1>
        <p className="mx-auto mb-8 max-w-md text-muted">
          {/* Самая частая причина здесь — не опечатка в адресе, а разбор,
              который автор удалил или сделал приватным уже после того, как
              ссылку показал поиск. Поэтому говорим об этом прямо. */}
          Возможно, разбор удалён или автор скрыл его. Ссылка из поиска могла
          устареть.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/" className="btn btn-primary h-10 px-5">
            К аккордам для гитары
          </Link>
          <Link href="/ukulele" className="btn btn-outline h-10 px-5">
            Укулеле
          </Link>
        </div>
      </div>
    </main>
  );
}
