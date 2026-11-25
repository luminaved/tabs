import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content-Security-Policy с одноразовым nonce на каждый ответ.
 *
 * Почему не строчкой в next.config.mjs, где лежат остальные заголовки: Next
 * вставляет в страницу собственные инлайновые скрипты (загрузчик, стриминг,
 * гидратация). Статический CSP пришлось бы разрешать через 'unsafe-inline' —
 * то есть написать заголовок, который ничего не запрещает. Nonce меняется от
 * запроса к запросу, поэтому его нельзя подставить заранее, и генерировать его
 * может только код, выполняющийся на каждый запрос.
 *
 * Как Next узнаёт nonce: middleware кладёт готовый заголовок в ЗАПРОС, Next
 * вычитывает оттуда `nonce-…` и проставляет его своим тегам <script> сам.
 * Поэтому заголовок ставится дважды — в запрос (для Next) и в ответ (для
 * браузера).
 *
 * README отдельно оговаривает, что авторизация сознательно живёт не в
 * middleware, чтобы не тащить bcrypt и Prisma в edge-runtime. Здесь этого и
 * нет: файл не импортирует ничего, кроме next/server, и работает со строками.
 */

const isDev = process.env.NODE_ENV === 'development';

function makeNonce(): string {
  // Web Crypto вместо Buffer: он есть и в edge-runtime, и в Node без оговорок.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function policy(nonce: string): string {
  return [
    "default-src 'self'",

    // 'strict-dynamic': доверие получают скрипты, загруженные скриптом с
    // нашим nonce, — так работает разбиение бандла на чанки, и при этом
    // белый список путей становится не нужен (современные браузеры при
    // 'strict-dynamic' игнорируют 'self' и host-выражения здесь).
    // 'unsafe-eval' — только в разработке: на нём держится HMR. В сборке его
    // нет, и стороннего скрипта на сайте нет вовсе.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,

    // 'unsafe-inline' для стилей убрать нельзя, и это не небрежность: nonce
    // применим к тегу <style>, но НЕ к атрибуту style=, а React расставляет
    // именно атрибуты (Avatar, диаграммы, полосы на графиках). Плюс свои
    // инлайновые стили вставляет сам Next. Риск здесь несопоставим со
    // скриптовым: выполнить код через атрибут стиля нельзя.
    "style-src 'self' 'unsafe-inline'",

    // data: — обложка и аватар в превью редактора приходят data URL'ом, плюс
    // фоновая SVG-текстура в globals.css. blob: — предпросмотр только что
    // выбранного файла (URL.createObjectURL в lib/resizeImage.ts).
    "img-src 'self' data: blob:",

    // Шрифты свои: next/font кладёт их рядом, сторонних хостов нет.
    "font-src 'self'",

    // Серверные экшены ходят на свой же адрес. В разработке добавляем
    // websocket — по нему живёт горячая перезагрузка.
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,

    // Формы уходят только к нам. Хосты провайдеров входа — на случай, если
    // Auth.js отправит туда форму, а не редирект (у Google так бывает).
    "form-action 'self' https://accounts.google.com https://oauth.yandex.ru",

    // Показывать сайт во фрейме незачем — согласовано с X-Frame-Options: DENY
    // в next.config.mjs.
    "frame-ancestors 'none'",
    "frame-src 'none'",

    // <base> подменяет корень для всех относительных ссылок — сузим до своего.
    "base-uri 'self'",

    // Плагинов на сайте нет.
    "object-src 'none'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = makeNonce();
  const csp = policy(nonce);

  // Заголовки запроса — чтобы Next достал отсюда nonce для своих скриптов.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * CSP осмысленна для документов, а не для картинок и статики. Исключаем:
     *   _next/static, _next/image — сборка и оптимизатор картинок;
     *   covers, avatars — наши маршруты картинок (у них свои заголовки, и
     *     лишний разбор на каждую обложку в каталоге ни к чему);
     *   favicon.ico, icon.svg, apple-icon.png, icon-192.png, icon-512.png —
     *     иконки приложения (см. scripts/make-icons.mjs);
     *   splash/ — заставки запуска на iOS (scripts/make-splash.mjs);
     *   manifest.webmanifest, robots.txt, sitemap.xml, feed.xml — статика и
     *     машинные форматы: скриптов там нет, а CSP на XML только мешал бы
     *     читалкам и валидаторам.
     */
    {
      source:
        '/((?!_next/static|_next/image|covers/|avatars/|favicon.ico|icon.svg|apple-icon.png|icon-192.png|icon-512.png|splash/|manifest.webmanifest|robots.txt|sitemap.xml|feed.xml).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
