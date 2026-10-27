'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { EMPTY_FIELDS, IDEA_FIELDS, type Idea, type IdeaFields, type TerritoryOption } from '@/lib/idea';
import { createIdea, updateIdea } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';

/** Criar ou editar uma ideia à mão. */
export function IdeaDrawer({ idea, personas, options, defaults, onClose }: {
  idea: Idea | null; personas: { id: string; name: string }[]; options: TerritoryOption[]; defaults: { persona: string; territory: string }; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [persona, setPersona] = useState(idea ? idea.personaId ?? PUBLICO_ID : defaults.persona || personas[0]?.id || PUBLICO_ID);
  const [territory, setTerritory] = useState(idea ? idea.territoryId ?? '' : defaults.territory);
  const [territoryText, setTerritoryText] = useState(idea?.territoryId ? '' : idea?.territory ?? '');
  const [f, setF] = useState<IdeaFields>(() => (idea ? { pain: idea.pain, impact: idea.impact, cause: idea.cause, guide: idea.guide, plan: idea.plan, gain: idea.gain, desire: idea.desire, cta: idea.cta } : EMPTY_FIELDS));
  const [err, setErr] = useState('');
  const terrOpts = options.filter((o) => o.personaId === persona);

  const save = () => start(async () => {
    const input = { personaId: persona === PUBLICO_ID ? null : persona, territoryId: territory || null, territory: territoryText, ...f };
    const r = idea ? await updateIdea(idea.id, input) : await createIdea(input);
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="pe-drawer" role="dialog" aria-modal="true" aria-label={idea ? 'Editar ideia' : 'Nova ideia'}>
        <header>
          <h2>{idea ? 'Editar ideia' : 'Nova ideia'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="pe-drawer-body">
          <div className="field">
            <label htmlFor="dp">Persona relacionada</label>
            <select id="dp" value={persona} onChange={(e) => { setPersona(e.target.value); setTerritory(''); }}>{[...personas, { id: PUBLICO_ID, name: 'Público geral' }].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <small className="muted">Quem vai se reconhecer nesta ideia.</small>
          </div>
          <div className="field">
            <label htmlFor="dt">Território</label>
            <select id="dt" value={territory} onChange={(e) => setTerritory(e.target.value)}>
              <option value="">Sem território do mapa</option>
              {terrOpts.map((o) => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.label}</option>)}
            </select>
            {!territory && <input type="text" value={territoryText} onChange={(e) => setTerritoryText(e.target.value)} maxLength={200} placeholder="Ou escreva o tema à mão" style={{ marginTop: 6 }} />}
            <small className="muted">De onde a ideia nasce (opcional).</small>
          </div>
          {IDEA_FIELDS.map((x) => (
            <div key={x.key} className="field">
              <label htmlFor={`f-${x.key}`}>{x.label}</label>
              <textarea id={`f-${x.key}`} rows={x.rows} value={f[x.key]} maxLength={x.max} placeholder={x.placeholder} onChange={(e) => setF((s) => ({ ...s, [x.key]: e.target.value }))} />
              <small className="muted">{x.help}</small>
            </div>
          ))}
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={save} disabled={pending || !f.pain.trim()}>{pending ? 'Salvando…' : 'Salvar ideia'}</button>
        </footer>
      </aside>
    </div>
  );
}
