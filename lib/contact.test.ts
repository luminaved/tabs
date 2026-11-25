import { describe, expect, it } from 'vitest';
import { copyrightMailto, parseContactEmail } from './contact';

describe('parseContactEmail', () => {
  it('корректный адрес проходит', () => {
    expect(parseContactEmail('copyright@example.ru')).toBe('copyright@example.ru');
  });

  it('обрезает пробелы вокруг', () => {
    // Переменные окружения регулярно приезжают с пробелом или переводом строки.
    expect(parseContactEmail('  copyright@example.ru \n')).toBe('copyright@example.ru');
  });

  it('незаданная переменная — это null, а не пустая строка', () => {
    expect(parseContactEmail(undefined)).toBeNull();
    expect(parseContactEmail(null)).toBeNull();
    expect(parseContactEmail('')).toBeNull();
    expect(parseContactEmail('   ')).toBeNull();
  });

  it('опечатка не превращается в битую ссылку mailto:', () => {
    // Заметить такое некому: владелец сайта себе жалобу не пишет. Пусть лучше
    // страница честно скажет «адреса нет», чем предложит нерабочий адрес.
    expect(parseContactEmail('copyright@example')).toBeNull();
    expect(parseContactEmail('copyright.example.ru')).toBeNull();
    expect(parseContactEmail('копирайт собака example.ru')).toBeNull();
  });
});

describe('copyrightMailto', () => {
  it('подставляет тему письма', () => {
    const link = copyrightMailto('c@example.ru');
    expect(link.startsWith('mailto:c@example.ru?')).toBe(true);
    expect(decodeURIComponent(link)).toContain('subject=Обращение правообладателя');
  });

  it('пробел кодируется как %20, а не как «+»', () => {
    // В mailto: (RFC 6068) плюс — обычный символ, а не пробел: почтовый клиент
    // показал бы тему «Обращение+правообладателя». Именно так и вело себя
    // URLSearchParams, которое здесь стояло сначала.
    const link = copyrightMailto('c@example.ru', 'https://site.ru/songs/x');
    expect(link).not.toContain('+');
    expect(link).toContain('%20');
  });

  it('со страницы разбора кладёт её адрес в тело письма', () => {
    // Обращение без точного URL — первая причина уточняющей переписки, а она
    // стоит суток сверху к сроку удаления.
    const link = copyrightMailto('c@example.ru', 'https://site.ru/songs/pesnya-abc123');
    expect(decodeURIComponent(link)).toContain('https://site.ru/songs/pesnya-abc123');
  });

  it('без адреса страницы тела письма нет', () => {
    expect(copyrightMailto('c@example.ru')).not.toContain('body=');
  });

  it('спецсимволы в адресе страницы экранируются', () => {
    const link = copyrightMailto('c@example.ru', 'https://site.ru/?a=1&b=2');
    // Сырой «&» разорвал бы ссылку mailto на два параметра.
    expect(link).not.toContain('b=2&');
    expect(decodeURIComponent(link)).toContain('https://site.ru/?a=1&b=2');
  });
});
