'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import type { SuggestedIdea } from '@/lib/ai/idea';
import { ESTIMATED_COST_IDEA_BASE, ESTIMATED_COST_PER_IDEA, type TerritoryOption } from '@/lib/idea';
import { addSuggestedIdeas } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';
import { IdeaBody } from './idea-body';
import { IconSpark } from '../../icons';
import { TerritorySelect, pairStatus } from './territory-select';
import { ExtraPersonas, PersonaOptions, personaList, type PersonaOpt } from './persona-options';

/** Gera ideias com IA em 2 passos: 1) persona, território e quantidade; 2) revisar o que entra. */
export function IdeaModal({ personas, options, initialPersona, initialTerritory, hasKey, hasAbout, onClose }: {
  personas: PersonaOpt[]; options: TerritoryOption[]; initialPersona: string; initialTerritory: string; hasKey: boolean; hasAbout: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const all = [...personas, { id: PUBLICO_ID, name: 'Público geral' }];
  // tema sem nenhuma persona ligada: já começa com o público geral
  const noPersonaTheme = (id: string) => { const o = options.find((x) => x.id === id); return !!o && !o.personaIds.length; };
  const [persona, setPersona] = useState(initialPersona || (noPersonaTheme(initialTerritory) ? PUBLICO_ID : all[0]?.id || PUBLICO_ID));
  const [extra, setExtra] = useState<string[]>([]);
  const [territory, setTerritory] = useState(initialTerritory);
  const [count, setCount] = useState(3);
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ideas, setIdeas] = useState<SuggestedIdea[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [from, setFrom] = useState<'persona' | 'territory'>(initialTerritory && !initialPersona ? 'territory' : 'persona');
  const cur = options.find((o) => o.id === territory);
  // partindo de um tema do mapa, a ideia é sempre para o público geral (sem persona)
  const main = from === 'territory' ? PUBLICO_ID : persona;
  const who = from === 'territory' ? [] : personaList(persona, extra);
  const pair = pairStatus(cur, main);
  const selected = ideas.filter((_, i) => !off.has(i)).length;

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ideas/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaIds: who, territoryId: territory || null, count, instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir ideias.');
      setIdeas(j.ideas); setOff(new Set()); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const add = () => start(async () => {
    const r = await addSuggestedIdeas(who, territory || null, ideas.filter((_, i) => !off.has(i)));
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
                <label>Por onde começar?</label>
                <div className="tr-choices" role="radiogroup" aria-label="Por onde começar">
                  <button type="button" role="radio" aria-checked={from === 'persona'} className={`tr-choice${from === 'persona' ? ' on' : ''}`} onClick={() => setFrom('persona')}><b>Por quem vai ler</b><small>Você já sabe com quem quer falar. Escolha a persona; o tema é opcional. Bom para criar ideias variadas para o mesmo público.</small></button>
                  <button type="button" role="radio" aria-checked={from === 'territory'} className={`tr-choice${from === 'territory' ? ' on' : ''}`} onClick={() => setFrom('territory')}><b>Por um tema do mapa</b><small>Você tem um assunto (até um debate amplo, como desemprego jovem). Escolha o tema: as ideias saem para o público geral, sem persona.</small></button>
                </div>
              </div>
              {(from === 'persona' ? ['persona', 'territory'] : ['territory']).map((k) => k === 'persona' ? (
                <Fragment key="p">
                <div className="field">
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
                <ExtraPersonas personas={personas} primary={persona} value={extra} onChange={setExtra} />
                </Fragment>
              ) : (
                <div className="field" key="t">
                  <label htmlFor="it">Território {from === 'persona' && <span className="muted">(opcional)</span>}</label>
                  <TerritorySelect id="it" options={options} persona={main} value={territory} onChange={(t) => { setTerritory(t); if (noPersonaTheme(t)) setPersona(PUBLICO_ID); }} empty="Sem território específico" />
                  {options.length === 0 && <small className="muted">O mapa ainda não tem territórios.</small>}
                  {from === 'persona' && territory && noPersonaTheme(territory) && persona === PUBLICO_ID && <small className="muted">Nenhuma persona está ligada a este tema, por isso a ideia já vem para o <b>público geral</b>. Você pode escolher uma persona acima.</small>}
                  {from === 'territory' && <small className="muted">Sem persona, a dor sai como <b>afirmação sobre o tema</b> (um fato do mercado ou do território), não como fala em primeira pessoa.</small>}
                  {pair === 'translated' && <small className="muted">✓ Já existe a tradução deste tema para esta persona; a IA vai usá-la como ponte.</small>}
                  {pair === 'linked' && <small className="muted">Esta persona já enxerga o tema, mas ainda não há tradução dele para o dia a dia dela. <Link href={`/admin/territorios?p=${persona}&n=${territory}`} className="vd-link">Traduzir no mapa →</Link></small>}
                  {pair === 'new' && <small className="muted">Esta persona ainda não está ligada ao tema: ao salvar, a ligação é criada. Para a ponte ficar melhor, <Link href={`/admin/territorios?p=${persona}&n=${territory}`} className="vd-link">traduza o tema para ela →</Link></small>}
                </div>
              ))}
              <div className="field">
                <label>Quantas ideias?</label>
                <div className="vd-chips">{[1, 2, 3, 5, 8].map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}</div>
              </div>
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Foque em quem paga aluguel. Use a imagem de “casa” como metáfora." />
              </details>
              <div className="notice info">A IA escreve a <b>dor em linguagem de rua</b>, o <b>impacto</b>, a <b>causa</b>, o <b>guia</b> (enquadramento progressista, à la Lakoff), os <b>argumentos</b> que sustentam a solução, o <b>ganho</b>, o <b>desejo</b> e a <b>CTA</b>, sem repetir as ideias que já existem para este território.</div>
              {!hasAbout && <div className="notice warn">Você ainda não descreveu <b>o que a organização faz</b> (em Territórios). Sem isso, os argumentos e a CTA ficam genéricos.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está escrevendo as ideias. Leva cerca de 20 a 50 segundos; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(ESTIMATED_COST_IDEA_BASE + count * ESTIMATED_COST_PER_IDEA)} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={suggest} disabled={busy || !hasKey || (from === 'territory' && !territory)}>{busy ? 'Gerando…' : <><IconSpark /> Gerar ideias</>}</button>
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
