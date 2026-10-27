'use client';

import { useEffect, useRef, useState } from 'react';

/** Menu "Mais": abre um painel de ações secundárias. Fecha ao clicar fora, com Esc ou num item marcado com data-close. */
export function Menu({ label = 'Mais', children, align = 'left' }: { label?: string; children: React.ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="tr-menu" ref={ref}>
      <button type="button" className="btn small ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label} <span aria-hidden>▾</span></button>
      {open && <div className={`tr-menu-panel ${align}`} role="menu" onClick={(e) => { if ((e.target as HTMLElement).closest('[data-close]')) setOpen(false); }}>{children}</div>}
    </div>
  );
}
