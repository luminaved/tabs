/** Скелетон личного кабинета — переход отзывается сразу, без «зависания». */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <div className="skeleton mb-4 h-4 w-32 rounded" />

      {/* Карточка аккаунта: аватар, три строки под ним и ряд действий */}
      <div className="card flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-56 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
        </div>
        {/* Ряд действий: на телефоне список во всю ширину, от `sm` — строка
            (см. .account-actions в globals.css). */}
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <div className="skeleton h-11 rounded-[0.7rem] sm:w-44" />
          <div className="skeleton h-11 rounded-[0.7rem] sm:w-32" />
          <div className="skeleton h-11 rounded-[0.7rem] sm:w-24" />
        </div>
      </div>

      <div className="mt-9 flex flex-col gap-3">
        <div className="skeleton h-6 w-36 rounded" />
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <div className="skeleton h-11 rounded-[0.7rem] sm:w-36" />
          <div className="skeleton h-11 rounded-[0.7rem] sm:w-36" />
          <div className="skeleton col-span-2 h-11 rounded-[0.7rem] sm:col-span-1 sm:w-40" />
        </div>
      </div>

      <div className="mt-10 mb-6 flex flex-col gap-3">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="flex gap-4">
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-8 w-32 rounded" />
        </div>
      </div>
      <SongRowsSkeleton />
    </main>
  );
}

/** Строки списка песен — общий вид для кабинета и каталога. */
export function SongRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-xl border border-line px-3 py-3">
          <div className="skeleton h-14 w-14 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="skeleton h-5 w-1/2 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
