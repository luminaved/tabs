import Link from 'next/link';
import { withPluralRu } from '@/lib/plural';

/**
 * Ссылки на исполнителей под каталогом.
 *
 * Это перелинковка, а не украшение. Страница исполнителя закрывает запрос
 * «<исполнитель> аккорды» — самый частый после запроса по названию песни, — но
 * попасть на неё раньше можно было только через строку конкретного разбора,
 * то есть ссылка исчезала, как только разбор уезжал на вторую страницу
 * каталога. Постоянный блок на первой странице даёт этим страницам стабильный
 * вес и путь для обхода.
 *
 * Количество разборов подписано намеренно: по нему видно, куда идти, и оно же
 * не даёт блоку выглядеть набором ключевых слов.
 */
export function ArtistCloud({ artists }: { artists: { name: string; count: number }[] }) {
  if (artists.length === 0) return null;

  return (
    <section className="mt-12 border-t border-line pt-6">
      {/* Заголовок — надзаголовком (.eyebrow), а не крупной антиквой: это
          служебный блок ссылок, и весом он должен уступать самому каталогу.
          Тег остаётся h2 — структура страницы для поиска от оформления
          не зависит. */}
      <h2 className="eyebrow mb-3">Исполнители</h2>
      <ul className="flex flex-wrap gap-2">
        {artists.map((a) => (
          <li key={a.name}>
            <Link
              href={`/artist/${encodeURIComponent(a.name)}`}
              className="artist-chip"
              title={`${a.name}: ${withPluralRu(a.count, 'разбор', 'разбора', 'разборов')}`}
            >
              {/* Имя отдельным элементом, чтобы обрезалось именно оно, а не
                  число рядом (см. .artist-chip-name в globals.css). */}
              <span className="artist-chip-name">{a.name}</span>
              <span className="artist-chip-count">{a.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
