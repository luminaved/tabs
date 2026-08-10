import { describe, expect, it } from 'vitest';
import { normalizePowerFifths, powerFifthPins, powerFifthRenames } from './powerFifths';

describe('powerFifthRenames', () => {
  it('находит старую запись без повторов, в порядке появления', () => {
    const body = '[5В]сло[3Н]во\n[5В]ещё[7Н]раз';
    expect(powerFifthRenames(body)).toEqual([
      { from: '5В', to: 'A5' },
      { from: '3Н', to: 'C5' },
      { from: '7Н', to: 'E5' },
    ]);
  });

  it('обычные аккорды не трогает', () => {
    expect(powerFifthRenames('[Am]текст[C]ещё[F#m]')).toEqual([]);
    // Уже переведённые — тоже: предлагать нечего
    expect(powerFifthRenames('[A5]текст[C5]')).toEqual([]);
  });

  it('написание нот берётся из тональности песни', () => {
    expect(powerFifthRenames('[1Н]', 'Am')).toEqual([{ from: '1Н', to: 'A#5' }]);
    // Бемольная тональность — бемольное написание
    expect(powerFifthRenames('[1Н]', 'Dm')).toEqual([{ from: '1Н', to: 'Bb5' }]);
  });

  it('на укулеле подсказки нет — там таких квинт не играют', () => {
    expect(powerFifthRenames('[5В]текст', null, 'ukulele')).toEqual([]);
  });
});

describe('normalizePowerFifths', () => {
  it('переписывает только токены аккордов', () => {
    expect(normalizePowerFifths('[5В]сло[3Н]во')).toBe('[A5]сло[C5]во');
  });

  it('такой же текст в словах песни остаётся нетронутым', () => {
    // «5В» в тексте — это просто буквы, а не аккорд
    expect(normalizePowerFifths('[5В]играем 5В на шестой')).toBe('[A5]играем 5В на шестой');
  });

  it('пробелы внутри скобок не мешают', () => {
    expect(normalizePowerFifths('[ 5В ]слово')).toBe('[A5]слово');
  });

  it('директивы и серый текст не задеты', () => {
    const body = '{start_of_chorus}\n[5В]припев\n%проигрыш%\n{end_of_chorus}';
    expect(normalizePowerFifths(body)).toBe(
      '{start_of_chorus}\n[A5]припев\n%проигрыш%\n{end_of_chorus}',
    );
  });

  it('на укулеле текст не меняется', () => {
    expect(normalizePowerFifths('[5В]текст', null, 'ukulele')).toBe('[5В]текст');
  });

  it('после замены предлагать больше нечего', () => {
    const once = normalizePowerFifths('[5В]a[7Н]b', 'Am');
    expect(powerFifthRenames(once, 'Am')).toEqual([]);
  });
});

describe('powerFifthPins', () => {
  it('высокая позиция закрепляется — картинка не съезжает', () => {
    // «12В» — форма на 12 ладу, а имя ей достаётся «E5», у которого встроенная
    // форма стоит на открытых струнах. Ровно тот случай, ради которого всё и
    // написано: без закрепления разбор уехал бы на 12 ладов вниз.
    expect(powerFifthPins('[12В]слово', {})).toEqual({
      E5: { frets: [12, 14, 14, -1, -1, -1] },
    });
  });

  it('ходовые позиции не закрепляются — встроенная форма и так та же', () => {
    // 5В → A5 (5 лад шестой струны), 3Н → C5 (3 лад пятой). Обе встроенные
    // формы совпадают с записью, закреплять нечего.
    expect(powerFifthPins('[5В]a[3Н]b', {})).toEqual({});
  });

  it('своя форма переезжает со старого имени на новое', () => {
    const mine = { frets: [7, 9, 9, -1, -1, -1] };
    expect(powerFifthPins('[5В]слово', { '5В': mine })).toEqual({ A5: mine });
  });

  it('старый ключ убирается, даже когда закреплять нечего', () => {
    // Форма под «5В» совпадает со встроенной для A5 — закрепления не будет, но
    // и висеть под именем, которого в тексте больше нет, она не должна.
    const same = { frets: [5, 7, 7, -1, -1, -1] };
    expect(powerFifthPins('[5В]слово', { '5В': same })).toEqual({});
  });

  it('чужие аппликатуры не трогает', () => {
    const other = { frets: [-1, 0, 2, 2, 2, 0] };
    expect(powerFifthPins('[12В]a[Am]b', { Am: other })).toEqual({
      Am: other,
      E5: { frets: [12, 14, 14, -1, -1, -1] },
    });
  });

  it('уже заданную под новым именем форму не перебивает', () => {
    const mine = { frets: [0, 2, 2, -1, -1, -1] };
    expect(powerFifthPins('[12В]a[E5]b', { E5: mine })).toEqual({ E5: mine });
  });

  it('столкновение имён: побеждает первая по тексту позиция', () => {
    // 5В и 17В обе дают A5. Двух разных позиций одно имя не выражает, поэтому
    // закрепляется первая встреченная — редактор предупреждает об этом заранее.
    expect(powerFifthPins('[17В]a[5В]b', {})).toEqual({
      A5: { frets: [17, 19, 19, -1, -1, -1] },
    });
  });

  it('на укулеле набор аппликатур остаётся как был', () => {
    const defs = { '5В': { frets: [5, 7, 7, -1, -1, -1] } };
    expect(powerFifthPins('[5В]текст', defs, null, 'ukulele')).toBe(defs);
  });

  it('переименовывать нечего — набор возвращается тот же', () => {
    const defs = { Am: { frets: [-1, 0, 2, 2, 1, 0] } };
    expect(powerFifthPins('[Am]текст', defs)).toBe(defs);
  });

  it('написание нового имени берётся из тональности', () => {
    // 1Н → A#5 в диезной тональности и Bb5 в бемольной; позиция одна и та же.
    expect(Object.keys(powerFifthPins('[13Н]a', {}, 'Am'))).toEqual(['A#5']);
    expect(Object.keys(powerFifthPins('[13Н]a', {}, 'Dm'))).toEqual(['Bb5']);
  });
});
