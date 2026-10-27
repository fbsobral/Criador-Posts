'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import type { SuggestedNode, TerritoryMode } from '@/lib/ai/territory';
import { ESTIMATED_COST_PER_TERRITORY, ESTIMATED_COST_TERRITORY_BASE, MAX_TERRITORY_NODES_PER_RUN } from '@/lib/territory';
import { addSuggestedNodes } from '@/lib/territory-actions';
import { IconSpark } from '../../icons';

type Choice = { id: string; mode: TerritoryMode; label: string; hint: string; count: number; depth: number };

/** Gera territórios com IA em 2 passos: 1) o que gerar; 2) revisar o que entra no mapa. */
export function TerritoryModal({ persona, parent, existingCount, hasKey, hasAbout, onClose }: {
  persona: { id: string; name: string }; parent: { id: string; name: string } | null; existingCount: number; hasKey: boolean; hasAbout: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const choices: Choice[] = parent
    ? [
      { id: 'kids', mode: 'expand', label: `Filhos de “${parent.name}”`, hint: 'Só o próximo nível abaixo deste território', count: 5, depth: 1 },
      { id: 'sub', mode: 'expand', label: 'Subárvore deste território', hint: 'Filhos e netos, de uma vez', count: 4, depth: 2 },
    ]
    : [
      { id: 'first', mode: 'first', label: 'Só o 1º nível', hint: 'As grandes áreas de interesse da persona', count: 6, depth: 1 },
      { id: 'full', mode: 'full', label: 'Território completo', hint: 'Áreas, subtemas e tópicos (vários níveis)', count: 4, depth: 3 },
    ];
  const [choice, setChoice] = useState(choices[0].id);
  const cur = choices.find((c) => c.id === choice) ?? choices[0];
  const [count, setCount] = useState(choices[0].count);
  const [depth, setDepth] = useState(choices[0].depth);
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nodes, setNodes] = useState<SuggestedNode[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());

  const pick = (c: Choice) => { setChoice(c.id); setCount(c.count); setDepth(c.depth); };
  const est = Math.min(MAX_TERRITORY_NODES_PER_RUN, count * (cur.mode === 'first' ? 1 : depth === 1 ? 1 : depth === 2 ? 4 : 8));

  const depthOf = useMemo(() => {
    const by = new Map(nodes.map((n) => [n.ref, n])); const memo = new Map<string, number>();
    const d = (n: SuggestedNode): number => { if (memo.has(n.ref)) return memo.get(n.ref)!; const v = n.parentRef && by.get(n.parentRef) ? 1 + d(by.get(n.parentRef)!) : 0; memo.set(n.ref, v); return v; };
    return d;
  }, [nodes]);
  const childrenOf = (ref: string) => nodes.filter((n) => n.parentRef === ref).map((n) => n.ref);
  const selected = nodes.filter((n) => !off.has(n.ref)).length;

  const toggle = (ref: string) => setOff((s) => {
    const n = new Set(s); const has = n.has(ref);
    const walk = (r: string) => { if (has) n.delete(r); else n.add(r); childrenOf(r).forEach(walk); };
    if (has) { // ligar um nó exige o pai ligado
      const node = nodes.find((x) => x.ref === ref); if (node?.parentRef && n.has(node.parentRef)) return s;
      walk(ref);
    } else walk(ref);
    return n;
  });

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/territories/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personaId: persona.id, parentId: parent?.id ?? null, mode: cur.mode, count, depth, instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir territórios.');
      setNodes(j.nodes); setOff(new Set()); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const add = () => start(async () => {
    const r = await addSuggestedNodes(persona.id, parent?.id ?? null, nodes.filter((n) => !off.has(n.ref)));
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Gerar territórios com IA">
        <header>
          <h2>{step === 'ask' ? 'Gerar territórios com IA' : 'Revise os territórios sugeridos'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        {step === 'ask' ? (
          <>
            <div className="pe-modal-body">
              <p className="muted">Para <b>{persona.name}</b>{parent ? <> · dentro de <b>{parent.name}</b></> : ''}</p>
              <div className="tr-choices">
                {choices.map((c) => (
                  <button key={c.id} type="button" className={`tr-choice${c.id === choice ? ' on' : ''}`} onClick={() => pick(c)} aria-pressed={c.id === choice}><b>{c.label}</b><small>{c.hint}</small></button>
                ))}
              </div>
              <div className="field">
                <label>{cur.mode === 'full' ? 'Quantas áreas de 1º nível?' : cur.mode === 'first' ? 'Quantas áreas?' : 'Quantos filhos diretos?'}</label>
                <div className="vd-chips">
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}
                </div>
              </div>
              {(cur.mode === 'full' || (cur.mode === 'expand' && cur.id === 'sub')) && (
                <div className="field">
                  <label>Níveis a gerar</label>
                  <div className="vd-chips">
                    {(cur.mode === 'full' ? [2, 3, 4] : [2, 3]).map((n) => <button key={n} type="button" className={`vd-chip${depth === n ? ' on' : ''}`} onClick={() => setDepth(n)}>{n} níveis</button>)}
                  </div>
                </div>
              )}
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Foque em quem ainda não tem reserva de emergência. Evite temas políticos." />
              </details>
              <div className="notice info">{persona.id === 'publico' ? <>A IA considera o <b>ICP</b> e <b>todas as personas</b> para criar territórios do público como um todo, e</> : <>A IA <b>foca só nesta persona</b> (sem misturar o público em geral ou outras personas) e</>} considera <b>tudo que já existe neste mapa</b>{existingCount > 0 ? <> ({existingCount} {existingCount === 1 ? 'território' : 'territórios'})</> : ''} para <b>não repetir</b> nada.</div>
              {!hasAbout && <div className="notice warn">Você ainda não descreveu <b>o que a organização faz</b> (card no topo da página). Sem isso, os territórios ficam genéricos: eles partem só do que a persona busca.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está montando os territórios. {cur.mode === 'full' ? 'O mapa completo leva cerca de 30 a 60 segundos' : 'Leva cerca de 10 a 30 segundos'}; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(ESTIMATED_COST_TERRITORY_BASE + est * ESTIMATED_COST_PER_TERRITORY * (cur.mode === 'first' ? 3 : 1))} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={suggest} disabled={busy || !hasKey}>{busy ? 'Gerando…' : <><IconSpark /> Gerar territórios</>}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="pe-modal-body">
              <p className="muted">Desmarque o que não quiser (desmarcar um item também tira o que está dentro dele).</p>
              <div className="tr-review">
                {nodes.map((n) => (
                  <label key={n.ref} className={`tr-rev${off.has(n.ref) ? ' off' : ''}`} style={{ paddingLeft: 10 + depthOf(n) * 22 }}>
                    <input type="checkbox" checked={!off.has(n.ref)} onChange={() => toggle(n.ref)} />
                    <span><b>{n.name}</b>{n.description && <small>{n.description}</small>}</span>
                  </label>
                ))}
              </div>
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <button type="button" className="btn ghost" onClick={() => setStep('ask')}>← Voltar</button>
              <div className="row-actions">
                <button type="button" className="btn" onClick={suggest} disabled={busy}>{busy ? 'Pensando…' : 'Sugerir outros'}</button>
                <button type="button" className="btn primary" onClick={add} disabled={pending || selected === 0}>{pending ? 'Adicionando…' : `Adicionar ${selected} ${selected === 1 ? 'território' : 'territórios'} ao mapa`}</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
