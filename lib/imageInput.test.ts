import { describe, expect, it } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  COVER_KEEP,
  COVER_MAX_BYTES,
  parseAvatarInput,
  parseCoverField,
  parseImageDataUrl,
  servableImageType,
} from './imageInput';

/** data URL с полезной нагрузкой примерно в `bytes` байт. */
function dataUrl(bytes: number, mime = 'image/jpeg'): string {
  const base64 = Buffer.alloc(bytes, 0x41).toString('base64');
  return `data:${mime};base64,${base64}`;
}

describe('parseImageDataUrl', () => {
  it('нормальная картинка проходит', () => {
    const url = dataUrl(50 * 1024);
    expect(parseImageDataUrl(url, COVER_MAX_BYTES)).toBe(url);
  });

  it('слишком тяжёлая — отбрасывается', () => {
    expect(parseImageDataUrl(dataUrl(COVER_MAX_BYTES + 1024), COVER_MAX_BYTES)).toBeNull();
  });

  it('размер считается по декодированным байтам, а не по длине строки', () => {
    // base64 длиннее исходника на треть: картинка у самого потолка обязана пройти.
    const url = dataUrl(COVER_MAX_BYTES - 16);
    expect(url.length).toBeGreaterThan(COVER_MAX_BYTES);
    expect(parseImageDataUrl(url, COVER_MAX_BYTES)).toBe(url);
  });

  it('поддерживаемые типы', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(parseImageDataUrl(dataUrl(1024, mime), COVER_MAX_BYTES)).not.toBeNull();
    }
  });

  it('не-картинки и мусор отбрасываются', () => {
    expect(parseImageDataUrl('data:text/html;base64,PHNjcmlwdD4=', COVER_MAX_BYTES)).toBeNull();
    expect(parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=', COVER_MAX_BYTES)).toBeNull();
    expect(parseImageDataUrl('https://example.com/a.jpg', COVER_MAX_BYTES)).toBeNull();
    expect(parseImageDataUrl('data:image/jpeg;base64,не-base64!!', COVER_MAX_BYTES)).toBeNull();
    expect(parseImageDataUrl('', COVER_MAX_BYTES)).toBeNull();
  });
});

describe('parseCoverField', () => {
  it('сентинел — не трогать', () => {
    expect(parseCoverField(COVER_KEEP)).toEqual({ kind: 'keep' });
    // Пробелы по краям приходят из формы сплошь и рядом.
    expect(parseCoverField(`  ${COVER_KEEP}  `)).toEqual({ kind: 'keep' });
  });

  it('пусто — убрать', () => {
    expect(parseCoverField('')).toEqual({ kind: 'remove' });
    expect(parseCoverField('   ')).toEqual({ kind: 'remove' });
  });

  it('картинка — поставить новую', () => {
    const url = dataUrl(30 * 1024);
    expect(parseCoverField(url)).toEqual({ kind: 'set', dataUrl: url });
  });

  it('негодная картинка — invalid, а не тихое удаление', () => {
    // Ключевое отличие: слишком тяжёлая обложка обязана дать ошибку, а не
    // молча превратиться в «убрать» и стереть существующую.
    expect(parseCoverField(dataUrl(COVER_MAX_BYTES + 4096)).kind).toBe('invalid');
    expect(parseCoverField('data:image/svg+xml;base64,PHN2Zz4=').kind).toBe('invalid');
    expect(parseCoverField('https://example.com/a.jpg').kind).toBe('invalid');
  });

  it('сентинел нельзя подделать картинкой', () => {
    // data URL всегда начинается с `data:`, поэтому пересечься они не могут.
    expect(parseCoverField(dataUrl(1024)).kind).toBe('set');
    expect(COVER_KEEP.startsWith('data:')).toBe(false);
  });
});

describe('servableImageType', () => {
  it('растровые типы отдаются как есть', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']) {
      expect(servableImageType(mime)).toBe(mime);
    }
  });

  // Главное, ради чего проверка и заведена: в старых записях мог осесть SVG
  // (прежняя валидация принимала любой `data:image/`), а по прямой ссылке на
  // /covers/<id> браузер разбирает его как документ и выполняет скрипты внутри.
  it('SVG не отдаётся', () => {
    expect(servableImageType('image/svg+xml')).toBeNull();
    expect(servableImageType('IMAGE/SVG+XML')).toBeNull();
  });

  it('всё прочее — тоже нет', () => {
    expect(servableImageType('text/html')).toBeNull();
    expect(servableImageType('application/xhtml+xml')).toBeNull();
    expect(servableImageType('image/svg')).toBeNull();
    expect(servableImageType('')).toBeNull();
  });

  it('регистр и пробелы не обходят проверку', () => {
    expect(servableImageType('  IMAGE/JPEG ')).toBe('image/jpeg');
  });
});

describe('parseAvatarInput', () => {
  it('своё фото проходит в пределах лимита', () => {
    const url = dataUrl(20 * 1024);
    expect(parseAvatarInput(url)).toBe(url);
    expect(parseAvatarInput(dataUrl(AVATAR_MAX_BYTES + 1024))).toBeNull();
  });

  it('картинка Google проходит', () => {
    const url = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
    expect(parseAvatarInput(url)).toBe(url);
  });

  it('произвольный внешний адрес не проходит', () => {
    expect(parseAvatarInput('https://tracker.example.com/pixel.gif')).toBeNull();
    expect(parseAvatarInput('http://lh3.googleusercontent.com/a/x')).toBeNull();
    // Хост должен совпадать по границе точки, а не по подстроке.
    expect(parseAvatarInput('https://googleusercontent.com.evil.ru/x')).toBeNull();
    expect(parseAvatarInput('javascript:alert(1)')).toBeNull();
    expect(parseAvatarInput('')).toBeNull();
  });
});
