'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { IconEdit, IconSpark } from '../../icons';
import { ExtraPersonas, PersonaOptions, personaList, type PersonaOpt } from './persona-options';
import { EMPTY_FIELDS, IDEA_FIELDS, type Idea, type IdeaFields, type TerritoryOption } from '@/lib/idea';
import { actionErrorMessage } from '@/lib/action-error';
import { createIdea, updateIdea } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';
import { TerritorySelect } from './territory-select';

/** Ver, criar ou editar uma ideia, em um lightbox: cada campo aparece como texto legível em uma caixa e só vira campo de edição quando você clica em Editar (ideia nova já abre tudo em edição). */
export function IdeaDrawer({ idea, personas, options, defaults, startRefine = false, hasKey = true, onClose }: {
  idea: Idea | null; personas: PersonaOpt[]; options: TerritoryOption[]; defaults: { persona: string; territory: string }; startRefine?: boolean; hasKey?: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [persona, setPersona] = useState(idea ? idea.personaId ?? PUBLICO_ID : defaults.persona || personas[0]?.id || PUBLICO_ID);
  const [extra, setExtra] = useState<string[]>(idea ? idea.personaIds.slice(1) : []);
  const who = personaList(persona, extra);
  const [territory, setTerritory] = useState(idea ? idea.territoryId ?? '' : defaults.territory);
  const [territoryText, setTerritoryText] = useState(idea?.territoryId ? '' : idea?.territory ?? '');
  const [f, setF] = useState<IdeaFields>(() => (idea ? { pain: idea.pain, impact: idea.impact, cause: idea.cause, guide: idea.guide, args: idea.args, gain: idea.gain, desire: idea.desire, cta: idea.cta } : EMPTY_FIELDS));
  const [err, setErr] = useState('');

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
      const r = await fetch('/api/ideas/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaIds: who, territory: territoryName, current: f, feedback, previous }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar a ideia.');
      setSugg(j); setFb2('');
    } catch (e) { setRerr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setRbusy(false); }
  }
  // refinar com IA só um campo (botão em cada caixa): pede, compara antes/depois e aplica só aquele campo
  type FieldRefine = { key: keyof IdeaFields; fb: string; busy: boolean; err: string; sugg: string | null; note: string };
  const [fr, setFr] = useState<FieldRefine | null>(null);
  const FCHIPS = ['Mais curto', 'Mais simples', 'Mais concreto', 'Outro ângulo'];
  async function askField() {
    if (!fr) return;
    const key = fr.key, prevSugg = fr.sugg;
    setFr({ ...fr, busy: true, err: '' });
    try {
      const r = await fetch('/api/ideas/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaIds: who, territory: territoryName, current: f, feedback: fr.fb, field: key, previous: prevSugg ? { ...f, [key]: prevSugg } : undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar este campo.');
      setFr((s) => (s && s.key === key ? { ...s, busy: false, sugg: (j.fields as IdeaFields)[key] ?? '', note: j.note ?? '' } : s));
    } catch (e) { setFr((s) => (s ? { ...s, busy: false, err: e instanceof Error ? e.message : 'Erro inesperado.' } : s)); }
  }
  const changes = sugg ? IDEA_FIELDS.filter((x) => sugg.fields[x.key].trim() !== f[x.key].trim()).map((x) => ({ label: x.label.replace(/ \(.*\)/, ''), before: f[x.key], after: sugg.fields[x.key] })) : [];
  const applyRefined = () => { if (!sugg) return; const nf = sugg.fields; setF(nf); setSugg(null); setRefine(false); setFb(''); setFirstFb(''); persist({ f: nf }); };
  const CHIPS = ['Dor mais de rua', 'Guia mais forte', 'Causa mais coletiva', 'Argumentos mais fortes', 'Mais curto', 'CTA mais suave'];

  // quais caixas estão em edição: ideia nova abre tudo; ideia existente abre só o que você clicar
  const ALL = ['meta', ...IDEA_FIELDS.map((x) => x.key)];
  const [editing, setEditing] = useState<Set<string>>(() => new Set(idea ? [] : ALL));
  const toggle = (k: string) => setEditing((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // ideia que já existe: salva na hora ao concluir uma caixa ou aplicar uma sugestão (sem fechar). A ideia nova só é criada ao clicar em Salvar.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function persist(over?: { f?: IdeaFields; persona?: string; territory?: string; territoryText?: string }) {
    if (!idea) return;
    const nf = over?.f ?? f, np = over?.persona ?? persona, nt = over?.territory ?? territory, ntx = over?.territoryText ?? territoryText;
    if (!nf.pain.trim()) { setErr('Escreva a dor antes de salvar.'); setSaveState('error'); return; }
    setSaveState('saving'); setErr('');
    try {
      const r = await updateIdea(idea.id, { personaId: np === PUBLICO_ID ? null : np, personaIds: personaList(np, extra), territoryId: nt || null, territory: ntx, ...nf });
      if (r.error) { setErr(r.error); setSaveState('error'); return; }
      snap.current = JSON.stringify([np, nt, ntx, nf]); setSaveState('saved'); router.refresh();
    } catch (e) { setErr(actionErrorMessage(e)); setSaveState('error'); }
  }
  const finish = (k: string) => { toggle(k); persist(); };
  const allOn = ALL.every((k) => editing.has(k));
  const snap = useRef(JSON.stringify([persona, extra, territory, territoryText, f]));
  const dirty = JSON.stringify([persona, extra, territory, territoryText, f]) !== snap.current;
  const tryClose = () => { if (dirty && !confirm('Descartar as alterações desta ideia?')) return; onClose(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') tryClose(); };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  });
  const personaName = who.length ? who.map((id) => personas.find((x) => x.id === id)?.name ?? '—').join(', ') : 'Público geral';
  const argItems = f.args.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

  const save = () => start(async () => {
    const input = { personaId: persona === PUBLICO_ID ? null : persona, personaIds: who, territoryId: territory || null, territory: territoryText, ...f };
    const r = idea ? await updateIdea(idea.id, input) : await createIdea(input);
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) onClose(); }}>
      <div className="pe-modal id-lightbox" role="dialog" aria-modal="true" aria-label={idea ? 'Ideia de conteúdo' : 'Nova ideia'}>
        <header>
          <h2>{idea ? 'Ideia de conteúdo' : 'Nova ideia'}</h2>
          <div className="row-actions">
            {idea && <button type="button" className="btn small ghost" onClick={() => { if (allOn) { setEditing(new Set()); persist(); } else setEditing(new Set(ALL)); }}><IconEdit /> {allOn ? 'Concluir edição' : 'Editar tudo'}</button>}
            <button type="button" className="btn small ghost" onClick={tryClose} aria-label="Fechar">✕</button>
          </div>
        </header>
        <div className="pe-modal-body">
          {!refine ? (
            <button type="button" className="btn pe-refine-open" onClick={() => setRefine(true)} disabled={!f.pain.trim() || !hasKey} title={!hasKey ? 'A IA não está configurada neste servidor' : undefined}><IconSpark /> Refinar com IA</button>
          ) : (
            <div className="pe-refine">
              <div className="pe-refine-head"><b>Refinar com IA</b><button type="button" className="btn small ghost" onClick={() => { setRefine(false); setSugg(null); setRerr(''); }}>Fechar</button></div>
              {!sugg ? (
                <>
                  <p className="muted">Diga o que mudar nesta ideia. A IA propõe a versão ajustada, você compara e só aplica se gostar.</p>
                  <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={800} placeholder="Ex.: a dor está formal demais, fale como a pessoa falaria no zap; e deixe os argumentos mais concretos…" />
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
          {editing.has('meta') ? (
            <div className="id-metaedit">
              <div className="field">
                <label htmlFor="dp">Persona relacionada</label>
                <select id="dp" value={persona} onChange={(e) => setPersona(e.target.value)}><PersonaOptions personas={personas} /></select>
                <small className="muted">Quem vai se reconhecer nesta ideia. Sem persona, a dor é uma afirmação sobre o tema.</small>
              </div>
              <ExtraPersonas personas={personas} primary={persona} value={extra} onChange={setExtra} />
              <div className="field">
                <label htmlFor="dt">Território</label>
                <TerritorySelect id="dt" options={options} persona={persona} value={territory} onChange={setTerritory} empty="Sem território do mapa" />
                {!territory && <input type="text" value={territoryText} onChange={(e) => setTerritoryText(e.target.value)} maxLength={200} placeholder="Ou escreva o tema à mão" style={{ marginTop: 6 }} />}
                <small className="muted">De onde a ideia nasce (opcional).</small>
              </div>
              {idea && <button type="button" className="btn small" onClick={() => finish('meta')}>Concluir</button>}
            </div>
          ) : (
            <div className="id-metabox">
              <div className="id-tags">
                <span className="id-tag persona">{personaName}</span>
                {territoryName && <span className="id-tag" title={territoryName}>{territoryName}</span>}
              </div>
              <button type="button" className="btn small ghost" onClick={() => toggle('meta')}><IconEdit /> Editar</button>
            </div>
          )}
          <div className="id-fgrid">
            {IDEA_FIELDS.map((x) => {
              const on = editing.has(x.key), text = f[x.key].trim();
              return (
                <div key={x.key} className={`id-fbox k-${x.key}${on ? ' editing' : ''}`}>
                  <div className="id-fhead">
                    <label htmlFor={`f-${x.key}`}>{x.label}</label>
                    <span className="id-fbtns">
                      <button type="button" className="btn small ghost id-fai" onClick={() => setFr(fr?.key === x.key ? null : { key: x.key, fb: '', busy: false, err: '', sugg: null, note: '' })} disabled={!hasKey || !f.pain.trim()} aria-expanded={fr?.key === x.key} title={!hasKey ? 'A IA não está configurada neste servidor' : `Refinar “${x.label.replace(/ \(.*\)/, '')}” com IA`}><IconSpark /> Refinar</button>
                      <button type="button" className="btn small ghost" onClick={() => (on ? finish(x.key) : toggle(x.key))}>{on ? 'Concluir' : <><IconEdit /> Editar</>}</button>
                    </span>
                  </div>
                  {fr?.key === x.key && (
                    <div className="id-fref">
                      {fr.sugg === null ? (
                        <>
                          <textarea rows={2} autoFocus value={fr.fb} onChange={(e) => setFr({ ...fr, fb: e.target.value })} maxLength={800} placeholder={`O que mudar em “${x.label.replace(/ \(.*\)/, '')}”? Ex.: mais curto, outra imagem, falar de outro jeito…`} />
                          <div className="aim-chips pe-chips-row">{FCHIPS.map((c) => <button type="button" key={c} onClick={() => setFr({ ...fr, fb: (fr.fb.trim() ? `${fr.fb.trim()}; ` : '') + c.toLowerCase() })}>{c}</button>)}</div>
                        </>
                      ) : (
                        <div className="id-fdiff">
                          {fr.note && <p className="pe-note">{fr.note}</p>}
                          {f[x.key].trim() && <div><span>Antes</span><s>{f[x.key]}</s></div>}
                          <div><span>Sugestão</span><p>{fr.sugg || '(vazio)'}</p></div>
                          <textarea rows={2} value={fr.fb} onChange={(e) => setFr({ ...fr, fb: e.target.value })} maxLength={800} placeholder="Não é bem isso? Peça outro ajuste sobre esta sugestão…" />
                        </div>
                      )}
                      {fr.err && <div className="notice err">{fr.err}</div>}
                      {fr.busy && <div className="notice info" role="status">Refinando… leva cerca de 10 a 25 segundos.</div>}
                      <div className="row-actions">
                        {fr.sugg !== null && <button type="button" className="btn small primary" onClick={() => { const nf = { ...f, [x.key]: fr.sugg ?? '' }; setF(nf); setFr(null); persist({ f: nf }); }} disabled={!fr.sugg}>✓ Aplicar neste campo</button>}
                        <button type="button" className={`btn small${fr.sugg === null ? ' primary' : ''}`} onClick={askField} disabled={fr.busy || fr.fb.trim().length < 3}>{fr.busy ? 'Refinando…' : fr.sugg === null ? <><IconSpark /> Sugerir</> : 'Pedir outro ajuste'}</button>
                        <button type="button" className="btn small ghost" onClick={() => setFr(null)}>{fr.sugg === null ? 'Cancelar' : 'Descartar'}</button>
                      </div>
                    </div>
                  )}
                  {on ? (
                    <>
                      <textarea id={`f-${x.key}`} autoFocus={!!idea} rows={Math.min(14, Math.max(x.rows + 1, Math.ceil(f[x.key].length / 58) + 1))} value={f[x.key]} maxLength={x.max} placeholder={x.placeholder} onChange={(e) => setF((s) => ({ ...s, [x.key]: e.target.value }))} />
                      <small className="muted">{x.help}</small>
                    </>
                  ) : text ? (
                    x.key === 'args' && argItems.length > 1 ? <ul className="id-ftext">{argItems.map((it, i) => <li key={i}>{it}</li>)}</ul> : <p className="id-ftext">{f[x.key]}</p>
                  ) : (
                    <button type="button" className="id-fempty" onClick={() => toggle(x.key)}>Sem texto ainda. Clique para escrever.</button>
                  )}
                </div>
              );
            })}
          </div>
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={tryClose}>{idea ? 'Fechar' : 'Cancelar'}</button>
          {idea && <span className={`id-savestate${saveState === 'error' ? ' err' : ''}`} role="status">{saveState === 'saving' ? 'Salvando…' : dirty ? 'Alterações ainda não salvas' : saveState === 'saved' ? '✓ Salvo' : saveState === 'error' ? 'Não foi possível salvar' : ''}</span>}
          <button type="button" className="btn primary" onClick={save} disabled={pending || !f.pain.trim()}>{pending ? 'Salvando…' : idea ? 'Salvar e fechar' : 'Salvar ideia'}</button>
        </footer>
      </div>
    </div>
  );
}
