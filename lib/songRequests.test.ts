import { describe, expect, it } from 'vitest';
import { requestMatchKey } from './songRequests';

const guitar = (title: string, artist?: string | null) =>
  requestMatchKey({ title, artist, instrument: 'guitar' });

describe('requestMatchKey', () => {
  it('склеивает записи, отличающиеся регистром, пробелами и пунктуацией', () => {
    const base = guitar('Кошка', 'Кишлак');
    expect(guitar('кошка', 'кишлак')).toBe(base);
    expect(guitar('  КОШКА  ', ' Кишлак ')).toBe(base);
    expect(guitar('«Кошка»!', 'Кишлак.')).toBe(base);
  });

  it('различает песни разных исполнителей', () => {
    expect(guitar('Кошка', 'Кишлак')).not.toBe(guitar('Кошка', 'Пошлая Молли'));
  });

  it('заявка без исполнителя — не то же, что с исполнителем', () => {
    // Иначе первая же безымянная заявка «Кошка» поглотила бы все «Кошка — X».
    // Ради этого исполнитель и сделан обязательным в форме: ключ склейки
    // держится на паре «название + исполнитель». Разбор нулевого случая
    // остаётся — записи без исполнителя лежат в базе с прежних времён.
    expect(guitar('Кошка')).not.toBe(guitar('Кошка', 'Кишлак'));
  });

  it('одноимённые песни разных исполнителей не склеиваются в одну заявку', () => {
    // Ровно то, ради чего поле стало обязательным: «Самолёты» есть у десятка
    // артистов, и без исполнителя все они были бы одной строкой в списке.
    const keys = ['Рудаков Радиопомехи', 'Земфира', 'Би-2'].map((a) =>
      guitar('Самолёты', a),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('инструмент входит в ключ: это разная работа', () => {
    expect(requestMatchKey({ title: 'Кошка', instrument: 'guitar' })).not.toBe(
      requestMatchKey({ title: 'Кошка', instrument: 'ukulele' }),
    );
  });

  it('неизвестный инструмент приводится к гитаре, а не плодит ключи', () => {
    expect(requestMatchKey({ title: 'Кошка', instrument: 'банджо' })).toBe(
      requestMatchKey({ title: 'Кошка', instrument: 'guitar' }),
    );
  });

  it('название без латиницы и кириллицы не вырождается в общий ключ', () => {
    // Иначе все такие заявки склеились бы в одну «пустую».
    const a = guitar('!!!');
    const b = guitar('???');
    expect(a).not.toBe(b);
    expect(a).toContain('raw:');
  });

  it('латиница и цифры переживают нормализацию', () => {
    expect(guitar('17 ножевых', 'CUPSIZE')).toBe(guitar('17 Ножевых', 'cupsize'));
  });
});
