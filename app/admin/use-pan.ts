'use client';

import { useEffect, type RefObject } from 'react';

/** Arrastar o fundo do quadro com o mouse rola o quadro (cursor de mãozinha). Cartões, botões e campos não iniciam o arraste. */
export function usePan(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let down = false, moved = false, sx = 0, sy = 0, sl = 0, st = 0;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('article, button, input, select, textarea, a, summary, [data-nopan]')) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY; sl = el.scrollLeft; st = el.scrollTop;
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true; el.classList.add('panning');
      el.scrollLeft = sl - dx; el.scrollTop = st - dy;
    };
    const onUp = () => { down = false; el.classList.remove('panning'); };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [ref, active]);
}
