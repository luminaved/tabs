/**
 * Начинка кнопки «Показать ещё» — подпись и стрелка вниз.
 *
 * Вынесена отдельно, потому что кнопок две и они РАЗНОГО типа: в каталоге это
 * настоящая ссылка на `?page=N` (её должен видеть поисковый робот, см.
 * [LoadMoreCatalog](./LoadMoreCatalog.tsx)), в списках карточек — обычная
 * `<button>`. Обёртку общей не сделать, а вот содержимое обязано совпадать до
 * пикселя: это один и тот же элемент интерфейса на разных страницах.
 *
 * Внешний вид задаёт класс `.load-more` в globals.css — там же объяснено,
 * почему кнопка выглядит именно так.
 */
export function LoadMoreLabel({ pending }: { pending: boolean }) {
  return (
    <>
      <span>{pending ? 'Загружаем…' : 'Показать ещё'}</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="load-more-arrow"
        aria-hidden
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    </>
  );
}
