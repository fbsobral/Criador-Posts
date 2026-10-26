'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPersona, deletePersona, updatePersona } from '@/lib/persona-actions';
import { emptyPersonaData, lines, type PersonaData } from '@/lib/persona';
import { IconTrash } from '../../icons';

export type PersonaRow = { id: string; name: string; tagline: string; groupId: string | null; data: PersonaData; source: string };
export type GroupRow = { id: string; name: string; description: string };

const LISTS: { key: 'goals' | 'pains' | 'objections' | 'triggers' | 'channels'; label: string; hint: string }[] = [
  { key: 'goals', label: 'Objetivos', hint: 'O que ela quer alcançar' },
  { key: 'pains', label: 'Dores', hint: 'O que a incomoda ou trava' },
  { key: 'objections', label: 'Objeções', hint: 'Por que hesitaria em comprar ou seguir' },
  { key: 'triggers', label: 'Gatilhos de decisão', hint: 'O que a faz agir' },
  { key: 'channels', label: 'Onde está', hint: 'Canais, comunidades e formatos que consome' },
];

/** Painel lateral para criar ou editar uma persona. */
export function PersonaDrawer({ persona, defaultGroupId, groups, onClose }: { persona: PersonaRow | null; defaultGroupId: string | null; groups: GroupRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const d0 = persona?.data ?? emptyPersonaData();
  const [name, setName] = useState(persona?.name ?? '');
  const [tagline, setTagline] = useState(persona?.tagline ?? '');
  const [groupId, setGroupId] = useState<string>(persona?.groupId ?? defaultGroupId ?? '');
  const [d, setD] = useState({ age: d0.age, role: d0.role, location: d0.location, bio: d0.bio, quote: d0.quote });
  const [ls, setLs] = useState({ goals: d0.goals.join('\n'), pains: d0.pains.join('\n'), objections: d0.objections.join('\n'), triggers: d0.triggers.join('\n'), channels: d0.channels.join('\n') });
  const [err, setErr] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  const data = (): PersonaData => ({ ...d, goals: lines(ls.goals), pains: lines(ls.pains), objections: lines(ls.objections), triggers: lines(ls.triggers), channels: lines(ls.channels) });
  const save = () => {
    setErr('');
    start(async () => {
      const input = { name, tagline, groupId: groupId || null, data: data() };
      const r = persona ? await updatePersona(persona.id, input) : await createPersona(input);
      if (r.error) { setErr(r.error); return; }
      router.refresh(); onClose();
    });
  };
  const del = () => {
    if (!persona || !confirm(`Excluir a persona “${persona.name}”?`)) return;
    start(async () => { await deletePersona(persona.id); router.refresh(); onClose(); });
  };

  return (
    <div className="pe-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="pe-drawer" role="dialog" aria-modal="true" aria-label={persona ? 'Editar persona' : 'Nova persona'}>
        <header>
          <h2>{persona ? 'Editar persona' : 'Nova persona'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="pe-drawer-body">
          <div className="field"><label htmlFor="pn">Nome</label><input id="pn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Marina, a gestora sobrecarregada" autoFocus={!persona} /></div>
          <div className="field"><label htmlFor="pg">Grupo</label>
            <select id="pg" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Sem grupo</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="pt">Resumo <span className="muted">(uma frase)</span></label><input id="pt" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} /></div>
          <div className="pe-row3">
            <div className="field"><label htmlFor="pa">Idade</label><input id="pa" value={d.age} onChange={(e) => setD({ ...d, age: e.target.value })} maxLength={30} placeholder="34 anos" /></div>
            <div className="field"><label htmlFor="pr">Profissão / papel</label><input id="pr" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} maxLength={100} /></div>
            <div className="field"><label htmlFor="pl">Local</label><input id="pl" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} maxLength={100} /></div>
          </div>
          <div className="field"><label htmlFor="pb">Contexto</label><textarea id="pb" rows={3} value={d.bio} onChange={(e) => setD({ ...d, bio: e.target.value })} maxLength={900} /></div>
          {LISTS.map((l) => (
            <div key={l.key} className="field"><label htmlFor={`l-${l.key}`}>{l.label} <span className="muted">· {l.hint} (um por linha)</span></label>
              <textarea id={`l-${l.key}`} rows={3} value={ls[l.key]} onChange={(e) => setLs({ ...ls, [l.key]: e.target.value })} /></div>
          ))}
          <div className="field"><label htmlFor="pq">Frase típica</label><input id="pq" value={d.quote} onChange={(e) => setD({ ...d, quote: e.target.value })} maxLength={300} placeholder="O que ela diria" /></div>
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          {persona ? <button type="button" className="btn ghost danger" onClick={del} disabled={pending}><IconTrash /> Excluir</button> : <span />}
          <div className="row-actions">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn primary" onClick={save} disabled={pending || !name.trim()}>{pending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
