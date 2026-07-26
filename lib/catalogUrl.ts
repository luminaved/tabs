/**
 * Адреса каталога с текущими параметрами отбора.
 *
 * Поиск, сортировка и «только подтверждённые» живут в строке запроса, а сами
 * переключатели остаются ссылками: работают без JS, индексируются и ими можно
 * поделиться. Отсюда требование — каждый переключатель обязан сохранять
 * ОСТАЛЬНЫЕ параметры. Раньше строка собиралась в каждом из них отдельно, и
 * новый отбор пришлось бы не забыть в трёх местах; теперь место одно.
 *
 * Значения по умолчанию в адрес не пишем: базовый каталог остаётся на чистом
 * `/`, и canonical не расходится с реальной ссылкой.
 */

export interface CatalogParams {
  /** Поисковый запрос. */
  query?: string;
  /** Сортировка; `new` — по умолчанию и в адрес не попадает. */
  sort?: string;
  /** Только подтверждённые модератором разборы. */
  verified?: boolean;
}

export function catalogHref(basePath: string, params: CatalogParams = {}): string {
  const qs = new URLSearchParams();
  if (params.query) qs.set('q', params.query);
  if (params.sort && params.sort !== 'new') qs.set('sort', params.sort);
  if (params.verified) qs.set('verified', '1');
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/**
 * Значение отбора «только подтверждённые» из адреса, формы или экшена.
 * Всё, кроме явной единицы, считаем выключенным — отбор включает пользователь,
 * и случайный мусор в параметре не должен молча резать выдачу.
 */
export function parseVerifiedParam(value: string | undefined | null): boolean {
  return value === '1';
}
