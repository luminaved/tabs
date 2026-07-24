import type { Metadata } from 'next';
import { SongViewer } from '@/components/SongViewer';

export const metadata: Metadata = {
  title: 'Демо — tabs',
  robots: { index: false, follow: false },
};

const SAMPLE = `{title: Тёплый вечер}
{artist: демо}
{key: G}
{tempo: 92}

{start_of_verse}
[G]Свет за [D]окном уже [Em]гаснет, дру[C]зья
[G]мы допо[D]ём этот вечер до [G]дна
{end_of_verse}

{start_of_chorus: Припев}
[C]Пой, пока [G]тянется [D]нить, [Em]пой %(× 2)%
[C]просто ды[D]ши и держись за ак[G]корд
{end_of_chorus}

{comment: медленнее, с чувством}

{start_of_bridge}
[Am]И пусть [D/F#]длинная строчка проверит, как оно переносится на узком экране без единого разрыва слова
{end_of_bridge}`;

export default function DemoPage() {
  return (
    <main className="container-app pb-28 pt-8">
      <p className="eyebrow mb-4">Демо страницы песни</p>
      <SongViewer
        record={{ body: SAMPLE }}
        note={'Играть спокойно, на 2/4. Проигрыш после припева — по желанию.'}
        annotations={[
          { id: 'd1', anchor: '7', text: 'Бой: вниз-вниз-вверх-вниз', type: 'rhythm' },
          { id: 'd2', anchor: '12', text: 'Чуть придержать перед припевом', type: 'transition' },
        ]}
      />
    </main>
  );
}
