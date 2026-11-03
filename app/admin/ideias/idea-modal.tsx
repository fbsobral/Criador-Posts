'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import type { SuggestedIdea } from '@/lib/ai/idea';
import { ESTIMATED_COST_IDEA_BASE, ESTIMATED_COST_PER_IDEA, IDEA_OBJECTIVES, type IdeaObjective, type TerritoryOption } from '@/lib/idea';
import { addSuggestedIdeas } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';
import { IdeaBody } from './idea-body';
import { IconSpark } from '../../icons';
import { TerritorySelect, pairStatus } from './territory-select';
import { PersonaOptions, type PersonaOpt } from './persona-options';

/** Gera ideias com IA em 2 passos: 1) persona, território e quantidade; 2) revisar o que entra. */
export function IdeaModal({ personas, options, initialPersona, initialTerritory, hasKey, hasAbout, onClose }: {
  personas: PersonaOpt[]; options: TerritoryOption[]; initialPersona: string; initialTerritory: string; hasKey: boolean; hasAbout: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const all = [...personas, { id: PUBLICO_ID, name: 'Público geral' }];
  const [persona, setPersona] = useState(initialPersona || all[0]?.id || PUBLICO_ID);
  const [territory, setTerritory] = useState(initialTerritory);
  const [count, setCount] = useState(3);
  const [objective, setObjective] = useState<IdeaObjective>('auto');
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ideas, setIdeas] = useState<SuggestedIdea[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [from, setFrom] = useState<'persona' | 'territory'>(initialTerritory && !initialPersona ? 'territory' : 'persona');
  const cur = options.find((o) => o.id === territory);
  const pair = pairStatus(cur, persona);
  const selected = ideas.filter((_, i) => !off.has(i)).length;

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ideas/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaId: persona, territoryId: territory || null, count, instructions, objective }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir ideias.');
      setIdeas(j.ideas); setOff(new Set()); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const add = () => start(async () => {
    const r = await addSuggestedIdeas(persona, territory || null, ideas.filter((_, i) => !off.has(i)));
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Gerar ideias com IA">
        <header>
          <h2>{step === 'ask' ? 'Gerar ideias com IA' : 'Revise as ideias sugeridas'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        {step === 'ask' ? (
          <>
            <div className="pe-modal-body">
              <div className="vd-segmented" role="radiogroup" aria-label="Por onde começar" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <button type="button" role="radio" aria-checked={from === 'persona'} className={from === 'persona' ? 'on' : ''} onClick={() => setFrom('persona')}>Partir da persona</button>
                <button type="button" role="radio" aria-checked={from === 'territory'} className={from === 'territory' ? 'on' : ''} onClick={() => setFrom('territory')}>Partir do território</button>
              </div>
              <p className="muted" style={{ margin: '-4px 0 0' }}>{from === 'persona' ? 'Escolha a pessoa e o tema que ela já enxerga (ou qualquer outro do mapa).' : 'Escolha o tema (por exemplo, um debate macro) e depois a persona para quem vamos traduzi-lo.'}</p>
              {(from === 'persona' ? ['persona', 'territory'] : ['territory', 'persona']).map((k) => k === 'persona' ? (
                <div className="field" key="p">
                  <label htmlFor="ip">Persona</label>
                  <select id="ip" value={persona} onChange={(e) => setPersona(e.target.value)}>
                    {from === 'territory' && cur && personas.some((p) => cur.personaIds.includes(p.id)) ? (
                      <>
                        <optgroup label="Já ligadas a este tema">{personas.filter((p) => cur.personaIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}{cur.translated.includes(p.id) ? ' · traduzido ✓' : ''}</option>)}</optgroup>
                        <optgroup label="Outras personas">{personas.filter((p) => !cur.personaIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value={PUBLICO_ID}>Público geral (sem persona)</option></optgroup>
                      </>
                    ) : <PersonaOptions personas={personas} />}
                  </select>
                  {persona === PUBLICO_ID && <small className="muted">Sem persona, a dor sai como <b>afirmação sobre o tema</b> (um fato do mercado ou do território), não como fala em primeira pessoa.</small>}
                </div>
              ) : (
                <div className="field" key="t">
                  <label htmlFor="it">Território {from === 'persona' && <span className="muted">(opcional)</span>}</label>
                  <TerritorySelect id="it" options={options} persona={persona} value={territory} onChange={setTerritory} empty="Sem território específico" />
                  {options.length === 0 && <small className="muted">O mapa ainda não tem territórios.</small>}
                  {pair === 'translated' && <small className="muted">✓ Já existe a tradução deste tema para esta persona; a IA vai usá-la como ponte.</small>}
                  {pair === 'linked' && <small className="muted">Esta persona já enxerga o tema, mas ainda não há tradução dele para o dia a dia dela. <Link href={`/admin/territorios?p=${persona}&n=${territory}`} className="vd-link">Traduzir no mapa →</Link></small>}
                  {pair === 'new' && <small className="muted">Esta persona ainda não está ligada ao tema: ao salvar, a ligação é criada. Para a ponte ficar melhor, <Link href={`/admin/territorios?p=${persona}&n=${territory}`} className="vd-link">traduza o tema para ela →</Link></small>}
                </div>
              ))}
              <div className="field">
                <label>Quantas ideias?</label>
                <div className="vd-chips">{[1, 2, 3, 5, 8].map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}</div>
              </div>
              <div className="field">
                <label>{count === 1 ? 'Objetivo desta ideia' : 'Objetivo destas ideias'}</label>
                <div className="vd-chips" role="radiogroup" aria-label={count === 1 ? 'Objetivo desta ideia' : 'Objetivo destas ideias'}>
                  {IDEA_OBJECTIVES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={objective === o.id} className={`vd-chip${objective === o.id ? ' on' : ''}`} onClick={() => setObjective(o.id)} title={o.hint}>{o.label}</button>)}
                </div>
                <small className="muted">{IDEA_OBJECTIVES.find((o) => o.id === objective)?.hint}. É o que a CTA vai pedir {count === 1 ? 'à pessoa' : 'às pessoas'}.</small>
              </div>
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Foque em quem paga aluguel. Use a imagem de “casa” como metáfora." />
              </details>
              <div className="notice info">A IA escreve a <b>dor em linguagem de rua</b>, o <b>impacto</b>, a <b>causa</b>, o <b>guia</b> (enquadramento progressista, à la Lakoff), o <b>plano</b>, o <b>ganho</b>, o <b>desejo</b> e a <b>CTA</b>, sem repetir as ideias que já existem para este território.</div>
              {!hasAbout && <div className="notice warn">Você ainda não descreveu <b>o que a organização faz</b> (em Territórios). Sem isso, o plano e a CTA ficam genéricos.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está escrevendo as ideias. Leva cerca de 20 a 50 segundos; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(ESTIMATED_COST_IDEA_BASE + count * ESTIMATED_COST_PER_IDEA)} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={suggest} disabled={busy || !hasKey}>{busy ? 'Gerando…' : <><IconSpark /> Gerar ideias</>}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="pe-modal-body">
              <p className="muted">Desmarque o que não quiser. Depois de salvar, você pode editar cada ideia.</p>
              <div className="id-review">
                {ideas.map((x, i) => (
                  <label key={i} className={`id-rev${off.has(i) ? ' off' : ''}`}>
                    <input type="checkbox" checked={!off.has(i)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                    <div>
                      <IdeaBody f={x} full />
                    </div>
                  </label>
                ))}
              </div>
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <button type="button" className="btn ghost" onClick={() => setStep('ask')}>← Voltar</button>
              <div className="row-actions">
                <button type="button" className="btn" onClick={suggest} disabled={busy}>{busy ? 'Pensando…' : 'Sugerir outras'}</button>
                <button type="button" className="btn primary" onClick={add} disabled={pending || selected === 0}>{pending ? 'Salvando…' : `Salvar ${selected} ${selected === 1 ? 'ideia' : 'ideias'}`}</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
