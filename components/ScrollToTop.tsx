'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Сброс прокрутки в самый верх при переходе на другую страницу.
 *
 * Свой обработчик у App Router есть, но он намеренно осторожен и в двух
 * случаях прокрутку НЕ делает: если первый элемент нового сегмента липкий или
 * фиксированный (у нас такие есть — панель редактора, тулбар разбора), он
 * уходит к следующему соседу и, не найдя его, выходит молча; а если верх
 * элемента уже попал во вьюпорт, выходит сразу. Итог для читателя один и тот
 * же — новая страница открывается с середины.
 *
 * Поэтому докручиваем сами, в эффекте: он выполняется ПОСЛЕ коммита нового
 * дерева, то есть после штатного обработчика, и его решение перекрывает.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  // Первый рендер — это не переход: страница только что открыта, и трогать
  // позицию нельзя (браузер мог сам восстановить её после перезагрузки).
  const first = useRef(true);
  // «Назад»/«вперёд» обязаны возвращать читателя туда, где он был, поэтому
  // такие переходы пропускаем. Флаг ставится в popstate — он приходит раньше,
  // чем роутер успевает сменить pathname.
  const pop = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      pop.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (pop.current) {
      pop.current = false;
      return;
    }
    // Переход по якорю ведёт к своему заголовку, а не наверх.
    if (window.location.hash) return;

    // `instant`, а не плавно: это не жест пользователя, а начало новой
    // страницы — анимация здесь читалась бы как рывок содержимого.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
