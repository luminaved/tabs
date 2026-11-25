/** Скелетон страницы автора (проверка существования — в layout.tsx). */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <section className="mb-8 flex items-center gap-4">
        <div className="skeleton h-24 w-24 shrink-0 rounded-full" />
        {/* Ширины тянущиеся: жёсткая полоска шире оставшегося места растягивает
            документ, а вместе с ним уезжает нижняя навигация — она закреплена
            по окну (подробности в скелетоне библиотеки). */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="skeleton h-8 w-full max-w-48 rounded-lg" />
          <div className="skeleton h-5 w-full max-w-40 rounded" />
        </div>
      </section>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
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
