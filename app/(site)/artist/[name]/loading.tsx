/**
 * Скелетон страницы исполнителя (проверка существования — в layout.tsx рядом).
 *
 * Раскладка повторяет реальную построчно, включая крошки: скелетон, который
 * короче содержимого, толкает страницу вниз в момент подмены — это и есть тот
 * сдвиг вёрстки, который меряет CLS.
 */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      {/* Крошки: одна строка 0.8rem + отступ 1.5rem снизу — как в .breadcrumbs */}
      <div className="skeleton mb-6 h-4 w-64 rounded" />

      <div className="mb-8 flex flex-col gap-2">
        {/* надзаголовок «Исполнитель» */}
        <div className="skeleton h-3 w-24 rounded" />
        {/* имя (h1, text-4xl) */}
        <div className="skeleton h-10 w-72 rounded-lg" />
        {/* «Аккорды на гитаре · N разборов» */}
        <div className="skeleton h-5 w-56 rounded" />
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
