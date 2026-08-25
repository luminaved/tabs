import { describe, expect, it } from 'vitest';
import { clientIpFrom, dayStamp, isBotUserAgent, visitorHash } from './visitor';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('isBotUserAgent', () => {
  it('настоящие браузеры проходят', () => {
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE)).toBe(false);
    expect(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe(false);
  });

  // Каталог индексируется, краулеры обходят каждый разбор — без отсева
  // счётчик мерил бы частоту обхода, а не популярность.
  it('поисковые роботы отсеиваются', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; YandexBot/3.0)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0)')).toBe(true);
  });

  it('превьюшники ссылок в мессенджерах — не читатели', () => {
    expect(isBotUserAgent('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isBotUserAgent('WhatsApp/2.23')).toBe(true);
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUserAgent('Discordbot/2.0')).toBe(true);
  });

  it('скрипты и headless-браузеры тоже', () => {
    expect(isBotUserAgent('curl/8.4.0')).toBe(true);
    expect(isBotUserAgent('python-requests/2.31.0')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 HeadlessChrome/120.0')).toBe(true);
    expect(isBotUserAgent('node-fetch/1.0')).toBe(true);
  });

  it('пустой User-Agent считаем автоматом', () => {
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent('   ')).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
  });
});

describe('clientIpFrom', () => {
  const from = (h: Record<string, string>) => clientIpFrom((n) => h[n] ?? null);

  it('берёт первый адрес цепочки — это клиент', () => {
    expect(from({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })).toBe('203.0.113.7');
  });

  it('пробелы вокруг адреса не мешают', () => {
    expect(from({ 'x-forwarded-for': '  203.0.113.7 , 70.41.3.18' })).toBe('203.0.113.7');
  });

  it('запасные заголовки по порядку', () => {
    expect(from({ 'x-real-ip': '198.51.100.4' })).toBe('198.51.100.4');
    expect(from({ 'cf-connecting-ip': '198.51.100.9' })).toBe('198.51.100.9');
  });

  it('ничего нет — пусто', () => {
    expect(from({})).toBe('');
    expect(from({ 'x-forwarded-for': '' })).toBe('');
  });
});

describe('visitorHash', () => {
  const base = { secret: 's3cret', day: '2026-07-27', ip: '203.0.113.7', userAgent: 'Chrome' };

  it('один и тот же посетитель за сутки — один отпечаток', () => {
    expect(visitorHash(base)).toBe(visitorHash({ ...base }));
  });

  it('назавтра отпечаток другой — слежка не накапливается', () => {
    expect(visitorHash({ ...base, day: '2026-07-28' })).not.toBe(visitorHash(base));
  });

  it('разные адреса и браузеры различаются', () => {
    expect(visitorHash({ ...base, ip: '203.0.113.8' })).not.toBe(visitorHash(base));
    expect(visitorHash({ ...base, userAgent: 'Firefox' })).not.toBe(visitorHash(base));
  });

  it('без серверной соли хеш был бы подбираем — соль участвует', () => {
    expect(visitorHash({ ...base, secret: 'другая' })).not.toBe(visitorHash(base));
  });

  it('сырых данных в отпечатке не остаётся', () => {
    const h = visitorHash(base);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('203.0.113.7');
  });

  // Разделитель между полями обязателен: без него «ab»+«c» и «a»+«bc» дали бы
  // один хеш, и соседние адреса могли бы слипаться.
  it('поля не склеиваются между собой', () => {
    expect(visitorHash({ secret: 'a', day: 'b', ip: 'c', userAgent: 'd' })).not.toBe(
      visitorHash({ secret: 'ab', day: '', ip: 'c', userAgent: 'd' }),
    );
  });
});

describe('dayStamp', () => {
  it('дата без времени', () => {
    expect(dayStamp(new Date('2026-07-27T23:41:09.000Z'))).toBe('2026-07-27');
  });

  it('меняется на границе суток UTC', () => {
    expect(dayStamp(new Date('2026-07-27T23:59:59Z'))).not.toBe(
      dayStamp(new Date('2026-07-28T00:00:01Z')),
    );
  });
});

describe('clientIpFrom: подмена заголовка', () => {
  const from = (h: Record<string, string>) => clientIpFrom((n) => h[n] ?? null);

  it('заголовок площадки важнее присланного клиентом', () => {
    // `x-forwarded-for` присылает КЛИЕНТ, прокси к нему лишь дописывает.
    // Пока он стоял первым, свой «X-Forwarded-For: 1.2.3.4» со случайным
    // числом делал каждый запрос запросом с нового адреса — то есть снимал
    // и потолок попыток входа, и потолок регистраций, и отсев накрутки.
    expect(
      from({ 'x-forwarded-for': '1.2.3.4', 'x-vercel-forwarded-for': '203.0.113.7' }),
    ).toBe('203.0.113.7');
    expect(from({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '203.0.113.8' })).toBe(
      '203.0.113.8',
    );
    expect(from({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('порядок доверия соблюдается целиком', () => {
    expect(
      from({
        'x-vercel-forwarded-for': '198.51.100.1',
        'cf-connecting-ip': '198.51.100.2',
        'x-real-ip': '198.51.100.3',
        'x-forwarded-for': '198.51.100.4',
      }),
    ).toBe('198.51.100.1');
  });

  it('без заголовков площадки берётся x-forwarded-for — иначе адреса нет вовсе', () => {
    expect(from({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })).toBe('203.0.113.7');
  });

  it('не адрес — как будто заголовка нет', () => {
    // Значение уходит в ключ счётчика попыток: мусор ключом быть не должен.
    expect(from({ 'x-real-ip': 'а'.repeat(5000) })).toBe('');
    expect(from({ 'x-real-ip': '<script>' })).toBe('');
    expect(from({ 'x-real-ip': 'rl:login:*' })).toBe('');
    expect(from({ 'x-real-ip': 'x' })).toBe('');
  });

  it('мусор в доверенном заголовке пропускает ход следующему', () => {
    expect(from({ 'x-real-ip': 'сломано', 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('IPv6 проходит', () => {
    expect(from({ 'x-real-ip': '2001:db8::8a2e:370:7334' })).toBe('2001:db8::8a2e:370:7334');
  });
});
