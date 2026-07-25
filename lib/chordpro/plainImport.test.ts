import { describe, expect, it } from 'vitest';
import { plainToChordPro } from './plainImport';

describe('plainToChordPro', () => {
  it('вставляет аккорды над слогами по колонкам', () => {
    const input = 'C      G\nПервая строка';
    expect(plainToChordPro(input)).toBe('[C]Первая [G]строка');
  });

  it('аккорд в начале строки', () => {
    expect(plainToChordPro('Am\nВторая')).toBe('[Am]Вторая');
  });

  it('строка только из аккордов (проигрыш)', () => {
    expect(plainToChordPro('Am    C')).toBe('[Am] [C]');
  });

  it('квинты в нотации лад+В/Н', () => {
    expect(plainToChordPro('3В    5Н\nтекст песни тут')).toBe('[3В]текст [5Н]песни тут');
  });

  it('заголовки секций → директивы', () => {
    expect(plainToChordPro('[Chorus]')).toBe('{start_of_chorus}');
    expect(plainToChordPro('[Verse 1]')).toBe('{start_of_verse}');
    expect(plainToChordPro('Припев:')).toBe('{start_of_chorus}');
    expect(plainToChordPro('[Intro]')).toBe('{comment: Intro}');
  });

  it('одиночный аккорд в скобках — не секция', () => {
    expect(plainToChordPro('[Am]')).toBe('[Am]');
  });

  it('обычный текст без аккордов проходит как есть', () => {
    expect(plainToChordPro('Просто строчка без аккордов')).toBe('Просто строчка без аккордов');
  });

  it('уже готовый ChordPro не ломается', () => {
    expect(plainToChordPro('[Am]сло[C]во')).toBe('[Am]сло[C]во');
  });

  it('аккорд за концом строки уходит в конец', () => {
    // G в 20-й колонке, текст короче — аккорд добавляется в конец строки
    expect(plainToChordPro('Am                  G\nкороткий')).toBe('[Am]короткий[G]');
  });

  it('сдвиг двигает все аккорды на символ', () => {
    const input = '    C\nстрока'; // C над «к» (колонка 4)
    expect(plainToChordPro(input, 0)).toBe('стро[C]ка');
    expect(plainToChordPro(input, 1)).toBe('строк[C]а'); // +1 вперёд
    expect(plainToChordPro(input, -1)).toBe('стр[C]ока'); // −1 назад
  });

  it('полный пример с секцией и пустой строкой', () => {
    const input = ['[Verse]', 'C      G', 'Первая строка', '', 'Am', 'Вторая'].join('\n');
    const expected = ['{start_of_verse}', '[C]Первая [G]строка', '', '[Am]Вторая'].join('\n');
    expect(plainToChordPro(input)).toBe(expected);
  });
});
