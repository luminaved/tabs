/**
 * Скелетон своей библиотеки (вход проверяет layout.tsx рядом).
 *
 * Повторяет раскладку LibraryView: ряд «заголовок + кнопка добавить», вкладки
 * инструментов с поиском, список строк. Высоты те же, чтобы подмена не
 * толкала страницу.
 */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-10 w-52 rounded-lg" />
        </div>
        {/* кнопка «Добавить разбор» */}
        <div className="skeleton h-11 w-40 shrink-0 rounded-[0.7rem]" />
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <div className="skeleton h-9 w-64 rounded-[0.6rem]" />
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
