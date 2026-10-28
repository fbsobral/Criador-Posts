'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import type { SuggestedIdea } from '@/lib/ai/idea';
import { ESTIMATED_COST_IDEA_BASE, ESTIMATED_COST_PER_IDEA, type TerritoryOption } from '@/lib/idea';
import { addSuggestedIdeas } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';
import { IdeaBody } from './idea-body';
import { IconSpark } from '../../icons';
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
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ideas, setIdeas] = useState<SuggestedIdea[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const terrOpts = options.filter((o) => o.personaId === persona);
  const selected = ideas.filter((_, i) => !off.has(i)).length;

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ideas/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaId: persona, territoryId: territory || null, count, instructions }) });
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
              <div className="field">
                <label htmlFor="ip">Persona relacionada</label>
                <select id="ip" value={persona} onChange={(e) => { setPersona(e.target.value); setTerritory(''); }}><PersonaOptions personas={personas} /></select>
              </div>
              <div className="field">
                <label htmlFor="it">Território de origem <span className="muted">(opcional)</span></label>
                <select id="it" value={territory} onChange={(e) => setTerritory(e.target.value)}>
                  <option value="">Sem território específico</option>
                  {terrOpts.map((o) => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.label}</option>)}
                </select>
                {terrOpts.length === 0 && <small className="muted">Esta persona ainda não tem território no mapa.</small>}
              </div>
              <div className="field">
                <label>Quantas ideias?</label>
                <div className="vd-chips">{[1, 2, 3, 5, 8].map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}</div>
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
