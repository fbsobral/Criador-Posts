'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPersona, deletePersona, updatePersona } from '@/lib/persona-actions';
import { emptyPersonaData, lines, type PersonaData } from '@/lib/persona';
import { IconSpark, IconTrash } from '../../icons';

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
type Refined = { name: string; tagline: string; data: PersonaData; note: string };
const CHIPS = ['Mais específica', 'Dores mais fortes', 'Mais jovem', 'Mais experiente', 'Mudar a profissão', 'Mais ligada à nossa oferta', 'Mais realista', 'Objeções mais fortes'];
const LIST_LABELS: [keyof PersonaData, string][] = [['goals', 'Objetivos'], ['pains', 'Dores'], ['objections', 'Objeções'], ['triggers', 'Gatilhos'], ['channels', 'Onde está']];
const SCALAR_LABELS: [keyof PersonaData | 'name' | 'tagline', string][] = [['name', 'Nome'], ['tagline', 'Resumo'], ['age', 'Idade'], ['role', 'Profissão'], ['location', 'Local'], ['bio', 'Contexto'], ['quote', 'Frase típica']];

export function PersonaDrawer({ persona, defaultGroupId, groups, startRefine = false, onClose }: { persona: PersonaRow | null; defaultGroupId: string | null; groups: GroupRow[]; startRefine?: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const d0 = persona?.data ?? emptyPersonaData();
  const [name, setName] = useState(persona?.name ?? '');
  const [tagline, setTagline] = useState(persona?.tagline ?? '');
  const [groupId, setGroupId] = useState<string>(persona?.groupId ?? defaultGroupId ?? '');
  const [d, setD] = useState({ age: d0.age, role: d0.role, location: d0.location, bio: d0.bio, quote: d0.quote });
  const [ls, setLs] = useState({ goals: d0.goals.join('\n'), pains: d0.pains.join('\n'), objections: d0.objections.join('\n'), triggers: d0.triggers.join('\n'), channels: d0.channels.join('\n') });
  const [err, setErr] = useState('');
  // refinar com IA: pedir → comparar → aplicar no formulário (só salva quando você clicar em Salvar)
  const [refine, setRefine] = useState(startRefine);
  const [fb, setFb] = useState('');
  const [firstFb, setFirstFb] = useState('');
  const [fb2, setFb2] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [sugg, setSugg] = useState<Refined | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  const data = (): PersonaData => ({ ...d, goals: lines(ls.goals), pains: lines(ls.pains), objections: lines(ls.objections), triggers: lines(ls.triggers), channels: lines(ls.channels) });
  const asRefineInput = () => ({ name, tagline, data: data() });
  async function askRefine(feedback: string, previous?: Refined) {
    setRbusy(true); setRerr('');
    try {
      const r = await fetch('/api/personas/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaId: persona?.id ?? '', current: asRefineInput(), feedback, previous: previous ? { name: previous.name, tagline: previous.tagline, data: previous.data } : undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar a persona.');
      setSugg(j); setFb2('');
    } catch (e) { setRerr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setRbusy(false); }
  }
  const changes = (() => {
    if (!sugg) return [] as { label: string; before: string; after: string }[];
    const cur = asRefineInput(); const out: { label: string; before: string; after: string }[] = [];
    for (const [k, label] of SCALAR_LABELS) {
      const b = String(k === 'name' ? cur.name : k === 'tagline' ? cur.tagline : cur.data[k as keyof PersonaData] ?? ''), a = String(k === 'name' ? sugg.name : k === 'tagline' ? sugg.tagline : sugg.data[k as keyof PersonaData] ?? '');
      if (a.trim() !== b.trim()) out.push({ label, before: b, after: a });
    }
    for (const [k, label] of LIST_LABELS) {
      const b = (cur.data[k] as string[]).join(' · '), a = (sugg.data[k] as string[]).join(' · ');
      if (a !== b) out.push({ label, before: b, after: a });
    }
    return out;
  })();
  const applyRefined = () => {
    if (!sugg) return;
    setName(sugg.name); setTagline(sugg.tagline);
    setD({ age: sugg.data.age, role: sugg.data.role, location: sugg.data.location, bio: sugg.data.bio, quote: sugg.data.quote });
    setLs({ goals: sugg.data.goals.join('\n'), pains: sugg.data.pains.join('\n'), objections: sugg.data.objections.join('\n'), triggers: sugg.data.triggers.join('\n'), channels: sugg.data.channels.join('\n') });
    setSugg(null); setRefine(false); setFb(''); setFirstFb('');
  };

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
          {!refine ? (
            <button type="button" className="btn pe-refine-open" onClick={() => setRefine(true)} disabled={!name.trim()}><IconSpark /> Refinar com IA</button>
          ) : (
            <div className="pe-refine">
              <div className="pe-refine-head"><b>Refinar com IA</b><button type="button" className="btn small ghost" onClick={() => { setRefine(false); setSugg(null); setRerr(''); }}>Fechar</button></div>
              {!sugg ? (
                <>
                  <p className="muted">Diga o que mudar nesta persona. A IA propõe a versão ajustada, você compara e só aplica se gostar.</p>
                  <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={800} placeholder="Ex.: deixe as dores mais ligadas à falta de tempo e troque a profissão por uma mais realista…" />
                  <div className="aim-chips pe-chips-row">{CHIPS.map((c) => <button type="button" key={c} onClick={() => setFb((t) => (t.trim() ? `${t.trim()}; ` : '') + c.toLowerCase())}>{c}</button>)}</div>
                  {rerr && <div className="notice err">{rerr}</div>}
                  {rbusy && <div className="notice info" role="status">Refinando a persona… leva cerca de 10 a 20 segundos.</div>}
                  <button type="button" className="btn primary" onClick={() => { setFirstFb(fb.trim()); askRefine(fb); }} disabled={rbusy || fb.trim().length < 3}>{rbusy ? 'Refinando…' : <><IconSpark /> Sugerir refinamento</>}</button>
                </>
              ) : (
                <>
                  {sugg.note && <p className="pe-note">{sugg.note}</p>}
                  {changes.length === 0 ? <p className="muted">A IA não mudou nada. Tente pedir de outro jeito.</p> : (
                    <div className="pe-diff">
                      {changes.map((c) => (
                        <div key={c.label} className="pe-diff-row"><b>{c.label}</b>{c.before && <s>{c.before}</s>}<span>{c.after || '(vazio)'}</span></div>
                      ))}
                    </div>
                  )}
                  {rerr && <div className="notice err">{rerr}</div>}
                  <div className="pe-refine-actions">
                    <button type="button" className="btn primary" onClick={applyRefined} disabled={changes.length === 0}>✓ Aplicar no formulário</button>
                    <button type="button" className="btn ghost" onClick={() => { setSugg(null); setRerr(''); }}>Descartar</button>
                  </div>
                  <div className="aim-fb">
                    <b style={{ fontSize: 13 }}>Não é bem isso? Peça outro ajuste</b>
                    <textarea rows={2} value={fb2} onChange={(e) => setFb2(e.target.value)} maxLength={800} placeholder="Ex.: ainda está genérica; mantenha a profissão como estava…" />
                    <button type="button" className="btn" onClick={() => askRefine(`${firstFb}\n(Novo pedido sobre a sugestão anterior): ${fb2.trim()}`, sugg)} disabled={rbusy || fb2.trim().length < 3}>{rbusy ? 'Refinando…' : '↻ Ajustar de novo'}</button>
                  </div>
                </>
              )}
            </div>
          )}
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
