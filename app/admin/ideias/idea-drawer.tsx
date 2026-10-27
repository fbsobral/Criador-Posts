'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconSpark } from '../../icons';
import { EMPTY_FIELDS, IDEA_FIELDS, type Idea, type IdeaFields, type TerritoryOption } from '@/lib/idea';
import { createIdea, updateIdea } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';

/** Criar ou editar uma ideia à mão. */
export function IdeaDrawer({ idea, personas, options, defaults, startRefine = false, hasKey = true, onClose }: {
  idea: Idea | null; personas: { id: string; name: string }[]; options: TerritoryOption[]; defaults: { persona: string; territory: string }; startRefine?: boolean; hasKey?: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [persona, setPersona] = useState(idea ? idea.personaId ?? PUBLICO_ID : defaults.persona || personas[0]?.id || PUBLICO_ID);
  const [territory, setTerritory] = useState(idea ? idea.territoryId ?? '' : defaults.territory);
  const [territoryText, setTerritoryText] = useState(idea?.territoryId ? '' : idea?.territory ?? '');
  const [f, setF] = useState<IdeaFields>(() => (idea ? { pain: idea.pain, impact: idea.impact, cause: idea.cause, guide: idea.guide, plan: idea.plan, gain: idea.gain, desire: idea.desire, cta: idea.cta } : EMPTY_FIELDS));
  const [err, setErr] = useState('');
  const terrOpts = options.filter((o) => o.personaId === persona);

  // refinar com IA: pedir → comparar → aplicar no formulário (só salva quando você clicar em Salvar)
  const [refine, setRefine] = useState(startRefine);
  const [fb, setFb] = useState('');
  const [firstFb, setFirstFb] = useState('');
  const [fb2, setFb2] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [sugg, setSugg] = useState<{ fields: IdeaFields; note: string } | null>(null);
  const territoryName = territory ? options.find((o) => o.id === territory)?.path ?? '' : territoryText;
  async function askRefine(feedback: string, previous?: IdeaFields) {
    setRbusy(true); setRerr('');
    try {
      const r = await fetch('/api/ideas/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaId: persona, territory: territoryName, current: f, feedback, previous }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar a ideia.');
      setSugg(j); setFb2('');
    } catch (e) { setRerr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setRbusy(false); }
  }
  const changes = sugg ? IDEA_FIELDS.filter((x) => sugg.fields[x.key].trim() !== f[x.key].trim()).map((x) => ({ label: x.label.replace(/ \(.*\)/, ''), before: f[x.key], after: sugg.fields[x.key] })) : [];
  const applyRefined = () => { if (!sugg) return; setF(sugg.fields); setSugg(null); setRefine(false); setFb(''); setFirstFb(''); };
  const CHIPS = ['Dor mais de rua', 'Guia mais forte', 'Causa mais coletiva', 'Plano mais prático', 'Mais curto', 'CTA mais suave'];

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
          {!refine ? (
            <button type="button" className="btn pe-refine-open" onClick={() => setRefine(true)} disabled={!f.pain.trim() || !hasKey} title={!hasKey ? 'A IA não está configurada neste servidor' : undefined}><IconSpark /> Refinar com IA</button>
          ) : (
            <div className="pe-refine">
              <div className="pe-refine-head"><b>Refinar com IA</b><button type="button" className="btn small ghost" onClick={() => { setRefine(false); setSugg(null); setRerr(''); }}>Fechar</button></div>
              {!sugg ? (
                <>
                  <p className="muted">Diga o que mudar nesta ideia. A IA propõe a versão ajustada, você compara e só aplica se gostar.</p>
                  <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={800} placeholder="Ex.: a dor está formal demais, fale como a pessoa falaria no zap; e deixe o plano em 3 passos…" />
                  <div className="aim-chips pe-chips-row">{CHIPS.map((c) => <button type="button" key={c} onClick={() => setFb((t) => (t.trim() ? `${t.trim()}; ` : '') + c.toLowerCase())}>{c}</button>)}</div>
                  {rerr && <div className="notice err">{rerr}</div>}
                  {rbusy && <div className="notice info" role="status">Refinando a ideia… leva cerca de 15 a 30 segundos.</div>}
                  <button type="button" className="btn primary" onClick={() => { setFirstFb(fb.trim()); askRefine(fb); }} disabled={rbusy || fb.trim().length < 3}>{rbusy ? 'Refinando…' : <><IconSpark /> Sugerir refinamento</>}</button>
                </>
              ) : (
                <>
                  {sugg.note && <p className="pe-note">{sugg.note}</p>}
                  {changes.length === 0 ? <p className="muted">A IA não mudou nada. Tente pedir de outro jeito.</p> : (
                    <div className="pe-diff">
                      {changes.map((c) => <div key={c.label} className="pe-diff-row"><b>{c.label}</b>{c.before && <s>{c.before}</s>}<span>{c.after || '(vazio)'}</span></div>)}
                    </div>
                  )}
                  {rerr && <div className="notice err">{rerr}</div>}
                  <div className="pe-refine-actions">
                    <button type="button" className="btn primary" onClick={applyRefined} disabled={changes.length === 0}>✓ Aplicar no formulário</button>
                    <button type="button" className="btn ghost" onClick={() => { setSugg(null); setRerr(''); }}>Descartar</button>
                  </div>
                  <div className="aim-fb">
                    <b style={{ fontSize: 13 }}>Não é bem isso? Peça outro ajuste</b>
                    <textarea rows={2} value={fb2} onChange={(e) => setFb2(e.target.value)} maxLength={800} placeholder="Ex.: o guia ficou abstrato; use uma imagem mais concreta…" />
                    <button type="button" className="btn" onClick={() => askRefine(`${firstFb}\n(Novo pedido sobre a sugestão anterior): ${fb2.trim()}`, sugg.fields)} disabled={rbusy || fb2.trim().length < 3}>{rbusy ? 'Refinando…' : '↻ Ajustar de novo'}</button>
                  </div>
                </>
              )}
            </div>
          )}
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
