import { describe, expect, it } from 'vitest';
import { jsonLdScript } from './jsonLd';

describe('jsonLdScript', () => {
  it('закрывающий тег из пользовательского поля не рвёт <script>', () => {
    const title = `x</script><img src=q onerror=alert(1)>`;
    const out = jsonLdScript({ headline: title });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('разметка остаётся валидным JSON и читается без потерь', () => {
    const data = {
      headline: `Песня </script> & <b>жирная</b>`,
      artist: 'Кто-то',
      key: 'Am',
    };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it('амперсанд экранируется', () => {
    expect(jsonLdScript({ a: 'Simon & Garfunkel' })).not.toContain('&');
    expect(JSON.parse(jsonLdScript({ a: 'Simon & Garfunkel' })).a).toBe('Simon & Garfunkel');
  });

  it('разделители строк U+2028/U+2029 экранируются', () => {
    const s = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = jsonLdScript({ s });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).s).toBe(s);
  });

  it('обычный текст не портится', () => {
    const data = { name: 'RawChords', description: 'аккорды и разборы песен' };
    expect(jsonLdScript(data)).toBe(JSON.stringify(data));
  });
});
