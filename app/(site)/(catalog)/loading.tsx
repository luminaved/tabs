/**
 * Скелетон каталога — клик по «Поиск»/логотипу отзывается мгновенно.
 *
 * Каталог вынесен в route-группу (catalog) намеренно: лежи этот loading.tsx
 * прямо в (site), его Suspense-граница накрыла бы и вложенные маршруты
 * (/songs/[id], /u/[id]) — они начали бы стримиться до проверки существования
 * и отдавали бы soft-404 вместо 404. Группа не влияет на URL: страница
 * по-прежнему обслуживает «/».
 */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <div className="mb-8 flex flex-col gap-2">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-10 w-56 rounded-lg" />
        <div className="skeleton h-5 w-72 rounded" />
      </div>
      <div className="mb-8 flex flex-col gap-3">
        <div className="skeleton h-[2.9rem] w-full rounded-[0.7rem]" />
        <div className="skeleton h-9 w-64 rounded-[0.6rem]" />
      </div>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
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
