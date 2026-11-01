'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconMore } from '../icons';
import { NAV, isActive } from './nav-config';

/** Menu do celular: barra fixa com os 4 atalhos principais + "Menu", que abre uma folha com todas as seções agrupadas. */
export function MobileNav({ brandName, role }: { brandName: string; role: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const all = NAV.flatMap((g) => g.items);
  const primary = all.filter((i) => i.primary);
  const inMore = !primary.some((i) => isActive(path, i)) && all.some((i) => isActive(path, i));

  useEffect(() => setOpen(false), [path]); // fecha ao navegar
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sheet.current?.focus();
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <nav className="mnav" aria-label="Menu principal">
        {primary.map((it) => {
          const on = isActive(path, it);
          return (
            <Link key={it.href} href={it.href} className={`mnav-item${on ? ' active' : ''}`} aria-current={on ? 'page' : undefined}>
              {it.icon}<span>{it.short ?? it.label}</span>
            </Link>
          );
        })}
        <button type="button" className={`mnav-item${open || inMore ? ' active' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
          <IconMore /><span>Menu</span>
        </button>
      </nav>
      {open && (
        <div className="msheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="msheet" role="dialog" aria-modal="true" aria-label="Todas as seções" ref={sheet} tabIndex={-1}>
            <div className="msheet-grip" aria-hidden />
            <div className="msheet-head">
              <span className="av">{brandName.slice(0, 1).toUpperCase()}</span>
              <div><b>{brandName}</b><small>{role}</small></div>
              <button type="button" className="btn small ghost" onClick={() => setOpen(false)} aria-label="Fechar menu">✕</button>
            </div>
            <div className="msheet-body">
              {NAV.map((g) => (
                <section key={g.label}>
                  <h3 className="nav-label">{g.label}</h3>
                  <div className="msheet-grid">
                    {g.items.map((it) => {
                      const on = isActive(path, it);
                      return <Link key={it.href} href={it.href} className={`msheet-link${on ? ' active' : ''}`} aria-current={on ? 'page' : undefined}>{it.icon}<span>{it.label}</span></Link>;
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
