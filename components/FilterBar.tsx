'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ряд сортировки и отбора со стрелкой «есть ещё».
 *
 * На узком экране ряд не помещается и прокручивается вбок. Беда обычной такой
 * ленты в том, что понять это можно только по обрезанному у края пункту — а
 * обрезанное слово читается как сломанная вёрстка, а не как приглашение
 * прокрутить. Поэтому у края появляется явная стрелка: она показывает, что ряд
 * продолжается, и по нажатию доматывает его. Домотали до конца — пропала.
 *
 * Клиентским компонент сделан ровно ради этой стрелки: положение прокрутки
 * известно только браузеру. Без JS стрелки не будет вовсе, и это лучше мёртвой
 * кнопки — сам ряд прокручивается пальцем в любом случае, а сортировка, отбор
 * и поиск на этой странице и так работают обычными ссылками и GET-формой.
 *
 * Сами пункты приходят пропсом `children` с сервера: клиентской логики в них
 * нет, и утаскивать их в бандл незачем.
 */
export function FilterBar({ children, label }: { children: React.ReactNode; label: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const update = () => {
      // Запас в 1px: ширины бывают дробными, и без него у самого края
      // стрелка мигала бы, не считая ряд домотанным.
      setHasMore(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1);
    };

    update();
    bar.addEventListener('scroll', update, { passive: true });
    // Не только на прокрутку: от `sm` ряд переносится по словам и доматывать
    // становится нечего, а поворот телефона меняет ширину без всякой прокрутки.
    const observer = new ResizeObserver(update);
    observer.observe(bar);

    return () => {
      bar.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  const scrollOn = () => {
    const bar = barRef.current;
    if (!bar) return;
    // Не до конца одним махом: короткий шаг сохраняет связь с тем, что было на
    // экране, и вторым нажатием доматывается остаток.
    bar.scrollBy({ left: Math.round(bar.clientWidth * 0.7) });
  };

  return (
    <div className="filter-bar-wrap">
      <div ref={barRef} className="filter-bar" role="group" aria-label={label}>
        {children}
      </div>
      {hasMore ? (
        <button
          type="button"
          className="filter-more"
          onClick={scrollOn}
          // Для клавиатуры и скринридера стрелка не нужна и только мешала бы:
          // сами пункты — обычные ссылки, доступные табуляцией, и браузер
          // подматывает ряд к той, на которую встал фокус. Кнопка здесь —
          // подсказка для пальца и мыши, не способ добраться до содержимого.
          tabIndex={-1}
          aria-hidden
        >
          <ChevronRight />
        </button>
      ) : null}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
