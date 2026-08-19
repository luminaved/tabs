/**
 * Скелетон каталога — клик по «Поиск»/логотипу отзывается мгновенно.
 *
 * Каталог вынесен в route-группу (catalog) намеренно: лежи этот loading.tsx
 * прямо в (site), его Suspense-граница накрыла бы и вложенные маршруты
 * (/songs/[id], /u/[id]) — они начали бы стримиться до проверки существования
 * и отдавали бы soft-404 вместо 404. Группа не влияет на URL: страница
 * по-прежнему обслуживает «/».
 *
 * Порядок и размеры повторяют CatalogView, включая то, что ниже `sm` спрятаны
 * надзаголовок и описание, а переключатель инструмента, наоборот, виден только
 * там. Скелетон не «примерно похож» на страницу намеренно: разойдись он с ней —
 * и содержимое, появившись, дёрнет раскладку ровно в тот момент, когда человек
 * уже начал читать.
 */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      {/* Ширины тянущиеся: жёсткая полоска шире экрана растягивает документ, а
          вместе с ним уезжает нижняя навигация — она закреплена по окну
          (подробности в скелетоне библиотеки). */}
      <div className="mb-5 flex flex-col gap-2 sm:mb-6">
        <div className="skeleton hidden h-4 w-24 rounded sm:block" />
        <div className="skeleton h-9 w-full max-w-56 rounded-lg sm:h-10" />
        <div className="skeleton hidden h-5 w-full max-w-72 rounded sm:block" />
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8">
        {/* Поиск — первым, как и на самой странице */}
        <div className="skeleton h-[2.9rem] w-full rounded-[0.7rem]" />
        {/* Переключатель инструмента: только на телефоне */}
        <div className="skeleton h-[2.65rem] w-full max-w-44 rounded-[0.75rem] sm:hidden" />
        {/* Лента порядка и отбора */}
        <div className="skeleton h-8 w-full max-w-80 rounded-[0.55rem]" />
      </div>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3.5 rounded-xl border border-line px-[0.7rem] py-[0.6rem]"
          >
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
