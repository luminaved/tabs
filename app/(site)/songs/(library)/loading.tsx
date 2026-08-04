/**
 * Скелетон своей библиотеки (вход проверяет layout.tsx рядом).
 *
 * Повторяет раскладку LibraryView: ряд «заголовок + кнопка добавить», вкладки
 * инструментов с поиском, список строк. Высоты те же, чтобы подмена не
 * толкала страницу.
 *
 * Ширины — ТЯНУЩИЕСЯ (`w-full max-w-*`), а не жёсткие, и это не косметика.
 * Пока в верхнем ряду стояли `w-52` и `w-40`, они вместе с зазором требовали
 * 384px при 338px доступных: кнопка вылезала за правый край, документ
 * становился шире экрана — и нижняя навигация, закреплённая по ОКНУ, уезжала
 * вместе с ним на всё время показа скелетона. Настоящая страница так не
 * ломалась: там заголовок переносится, а кнопка короткая.
 */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-10 w-full max-w-52 rounded-lg" />
        </div>
        {/* кнопка «+ Новая» */}
        <div className="skeleton h-11 w-28 shrink-0 rounded-[0.7rem]" />
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <div className="skeleton h-9 w-full max-w-64 rounded-[0.6rem]" />
        <div className="skeleton h-[2.9rem] w-full rounded-[0.7rem]" />
      </div>

      <ul className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 rounded-xl border border-line px-3 py-3">
            <div className="skeleton h-14 w-14 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="skeleton h-5 w-1/2 rounded" />
              <div className="skeleton h-4 w-1/3 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
