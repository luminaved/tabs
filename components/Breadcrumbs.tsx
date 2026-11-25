import Link from 'next/link';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';

/**
 * «Хлебные крошки»: видимая цепочка ссылок плюс та же цепочка разметкой.
 *
 * Разметка и разметка-для-глаз идут вместе намеренно. Google показывает крошки
 * в выдаче вместо адреса, но требует, чтобы заявленный путь совпадал с тем, что
 * на странице действительно есть, — разметка без видимой цепочки считается
 * недостоверной и просто игнорируется.
 *
 * Заодно это внутренняя перелинковка: со страницы разбора появляются ссылки на
 * каталог инструмента и на исполнителя, то есть у обхода есть путь вверх, а не
 * только вниз из каталога.
 *
 * Последняя крошка — текущая страница, ссылкой не делается.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length < 2) return null;
  const last = crumbs.length - 1;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }}
      />
      <nav aria-label="Хлебные крошки" className="breadcrumbs print-hide">
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.path}>
              {i === last ? (
                <span aria-current="page">{c.name}</span>
              ) : (
                <>
                  <Link href={c.path}>{c.name}</Link>
                  <span aria-hidden className="breadcrumbs-sep">
                    /
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
