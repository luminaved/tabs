import { describe, expect, it } from 'vitest';
import { lineToColumns } from './columns';
import { parseLyricLine } from './parse';

// Удобная обёртка: из сырой строки ChordPro сразу в колонки.
const cols = (raw: string) => lineToColumns(parseLyricLine(raw));

describe('lineToColumns', () => {
  it('аккорд достаётся первому слову, пробелы — точки переноса', () => {
    expect(cols('[Am]Текст с [C]аккордами')).toEqual([
      { chord: 'Am', text: 'Текст', spaceAfter: true },
      { text: 'с', spaceAfter: true },
      { chord: 'C', text: 'аккордами', spaceAfter: false },
    ]);
  });

  it('аккорд в середине слова остаётся приклеен к слогу (нет переноса)', () => {
    expect(cols('Тек[Am]ст')).toEqual([
      { text: 'Тек', spaceAfter: false },
      { chord: 'Am', text: 'ст', spaceAfter: false },
    ]);
  });

  it('текст до первого аккорда — без аккорда', () => {
    expect(cols('Текст [Am]тут')).toEqual([
      { text: 'Текст', spaceAfter: true },
      { chord: 'Am', text: 'тут', spaceAfter: false },
    ]);
  });

  it('аккорд в конце строки — самостоятельная колонка', () => {
    expect(cols('конец [G]')).toEqual([
      { text: 'конец', spaceAfter: true },
      { chord: 'G', text: '', spaceAfter: false },
    ]);
  });

  it('два аккорда подряд', () => {
    expect(cols('[Am][C]слово')).toEqual([
      { chord: 'Am', text: '', spaceAfter: false },
      { chord: 'C', text: 'слово', spaceAfter: false },
    ]);
  });

  it('строка без аккордов остаётся словами с переносами', () => {
    expect(cols('просто три слова')).toEqual([
      { text: 'просто', spaceAfter: true },
      { text: 'три', spaceAfter: true },
      { text: 'слова', spaceAfter: false },
    ]);
  });

  it('ведущие пробелы отбрасываются', () => {
    expect(cols('   [G]тут')).toEqual([{ chord: 'G', text: 'тут', spaceAfter: false }]);
  });

  it('%…% помечает серый текст, маркеры убираются', () => {
    expect(cols('обычный %серый% снова')).toEqual([
      { text: 'обычный', spaceAfter: true },
      { text: 'серый', muted: true, spaceAfter: true },
      { text: 'снова', spaceAfter: false },
    ]);
  });

  it('серый может охватывать несколько слов', () => {
    expect(cols('%тихо и мягко%')).toEqual([
      { text: 'тихо', muted: true, spaceAfter: true },
      { text: 'и', muted: true, spaceAfter: true },
      { text: 'мягко', muted: true, spaceAfter: false },
    ]);
  });

  it('% в середине слова разбивает на обычную и серую части', () => {
    expect(cols('те%кст%')).toEqual([
      { text: 'те', spaceAfter: false },
      { text: 'кст', muted: true, spaceAfter: false },
    ]);
  });

  it('серый работает вместе с аккордами', () => {
    expect(cols('[C]%проигрыш%')).toEqual([
      { chord: 'C', text: 'проигрыш', muted: true, spaceAfter: false },
    ]);
  });
});
