'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { splitPersonaName } from '@/lib/persona';

export type PickerItem = { id: string; name: string; color: string; count: number };
export type PickerGroup = { key: string; label: string; color: string; items: PickerItem[] };
const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/** Seletor de persona: um botão com a persona atual que abre a lista agrupada (sem rolagem lateral). */
export function PersonaPicker({ groups, currentId }: { groups: PickerGroup[]; currentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const all = groups.flatMap((g) => g.items);
  const cur = all.find((x) => x.id === currentId);
  const term = q.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, items: g.items.filter((x) => !term || x.name.toLowerCase().includes(term)) })).filter((g) => g.items.length);
  const split = cur ? splitPersonaName(cur.name) : null;

  return (
    <div className="tr-picker" ref={ref}>
      <button type="button" className={`tr-tab tr-picker-btn${cur ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {cur ? <><span className="pe-av sm" style={{ background: cur.color }}>{initialsOf(cur.name)}</span><span className="tr-tab-name" title={cur.name}><b>{split!.first}</b>{split!.label && <small>{split!.label}</small>}</span></> : <span className="tr-tab-name"><b>Escolher persona</b><small>{all.length} {all.length === 1 ? 'persona' : 'personas'}</small></span>}
        <span aria-hidden className="tr-picker-caret">▾</span>
      </button>
      {open && (
        <div className="tr-picker-panel" role="listbox">
          {all.length > 8 && <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona…" aria-label="Buscar persona" />}
          <div className="tr-picker-list">
            {shown.map((g) => (
              <div key={g.key}>
                <div className="tr-picker-group"><i style={{ background: g.color }} />{g.label}<em>{g.items.length}</em></div>
                {g.items.map((x) => {
                  const sp = splitPersonaName(x.name);
                  return (
                    <Link key={x.id} href={`/admin/territorios?p=${x.id}`} className={`tr-picker-item${x.id === currentId ? ' on' : ''}`} role="option" aria-selected={x.id === currentId} onClick={() => setOpen(false)}>
                      <span className="pe-av sm" style={{ background: x.color }}>{initialsOf(x.name)}</span>
                      <span className="tr-tab-name"><b>{sp.first}</b>{sp.label && <small>{sp.label}</small>}</span>
                      <i>{x.count}</i>
                    </Link>
                  );
                })}
              </div>
            ))}
            {shown.length === 0 && <p className="muted" style={{ padding: 10 }}>Nenhuma persona encontrada.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
