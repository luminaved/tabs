/**
 * Скелетон страницы разбора. Без него переход «висит» на старой странице,
 * пока сервер не отдаст готовый HTML; со скелетоном клик отзывается сразу.
 *
 * Работает в паре с layout.tsx этого же сегмента: проверка «разбор существует
 * и виден» сделана там (выше этой Suspense-границы), поэтому скелетон не мешает
 * отдавать честный 404 на несуществующие/приватные разборы.
 */
export default function Loading() {
  return (
    // Отступы — те же, что у настоящей страницы (pb-16 sm:pb-28): иначе при
    // подмене прыгает высота документа, а вместе с ней и полоса прокрутки.
    <main className="container-app pb-16 pt-8 sm:pb-28" aria-busy>
      {/* Крошки. Появились над обложкой позже скелетона, и без этой строки
          содержимое при подмене уезжало вниз на их высоту вместе с отступом. */}
      <div className="skeleton mb-6 h-4 w-full max-w-56 rounded" />

      <div className="mb-6 flex gap-4">
        <div className="skeleton h-[7.5rem] w-[7.5rem] shrink-0 rounded-[0.65rem] sm:h-[8.5rem] sm:w-[8.5rem]" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className="skeleton h-9 w-2/3 rounded-lg" />
          <div className="skeleton h-5 w-1/3 rounded" />
        </div>
      </div>
      <div className="skeleton mb-3 h-5 w-full max-w-56 rounded" />
      <div className="skeleton mb-8 h-14 w-full rounded-xl" />
      <div className="flex flex-col gap-3">
        {[92, 78, 85, 64, 88, 72, 80, 58].map((w, i) => (
          <div key={i} className="skeleton h-5 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </main>
  );
}
