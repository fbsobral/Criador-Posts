'use client';

import { useRouter } from 'next/navigation';
import { IconGrid, IconList } from '../../icons';

export type PostsView = 'cards' | 'lista';

/** Alterna entre cards e lista e lembra a escolha (cookie). */
export function ViewToggle({ view }: { view: PostsView }) {
  const router = useRouter();
  const set = (v: PostsView) => {
    if (v === view) return;
    document.cookie = `posts_view=${v}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`/admin/posts?v=${v}`);
    router.refresh();
  };
  return (
    <div className="view-toggle" role="group" aria-label="Modo de exibição">
      <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => set('cards')} aria-pressed={view === 'cards'} title="Ver em cards"><IconGrid /> <span>Cards</span></button>
      <button type="button" className={view === 'lista' ? 'on' : ''} onClick={() => set('lista')} aria-pressed={view === 'lista'} title="Ver em lista"><IconList /> <span>Lista</span></button>
    </div>
  );
}
