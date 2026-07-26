/** Скелетон личного кабинета — переход отзывается сразу, без «зависания». */
export default function Loading() {
  return (
    <main className="container-app py-10" aria-busy>
      <div className="mb-10 flex flex-col gap-6">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-56 rounded" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-11 w-40 rounded-[0.7rem]" />
          <div className="skeleton h-11 w-36 rounded-[0.7rem]" />
        </div>
      </div>
      <div className="mb-6 flex gap-4">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-8 w-32 rounded" />
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
