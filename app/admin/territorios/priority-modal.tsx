'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MAX_CRITERIA, MAX_LEVELS, type PriorityConfig } from '@/lib/priority';
import { IconSpark } from '../../icons';
import { savePriorityConfig } from '@/lib/territory-actions';
import { ReclassifyButton } from './reclassify-button';

const uid = () => Math.random().toString(36).slice(2, 8);
type Crit = PriorityConfig['criteria'][number];
type Lvl = PriorityConfig['levels'][number];

/** Gerencia os critérios (o que pesa no score) e as faixas (nome, cor e nota mínima de cada prioridade). */
export function PriorityModal({ config, canEdit, onClose, total, unscored, hasKey }: { config: PriorityConfig; canEdit: boolean; onClose: () => void; total: number; unscored: number; hasKey: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [c, setC] = useState<PriorityConfig>(() => JSON.parse(JSON.stringify(config)));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [instructions, setInstructions] = useState('');
  const dirty = JSON.stringify(c) !== JSON.stringify(config);
  async function suggest() {
    if (c.criteria.length && !confirm('Substituir os critérios atuais pelos sugeridos pela IA? (Nada é salvo até você clicar em Salvar.)')) return;
    setBusy(true); setErr(''); setNote('');
    try {
      const r = await fetch('/api/territories/criteria', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir critérios.');
      setC((s) => ({ ...s, criteria: j.criteria }));
      setNote('Critérios sugeridos. Ajuste nomes, descrições e pesos, e clique em Salvar. Depois, reclassifique os territórios.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const wsum = c.criteria.reduce((a, x) => a + (Number(x.weight) || 0), 0) || 1;
  const setCrit = (id: string, p: Partial<Crit>) => setC((s) => ({ ...s, criteria: s.criteria.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const setLvl = (id: string, p: Partial<Lvl>) => setC((s) => ({ ...s, levels: s.levels.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const save = () => start(async () => {
    const r = await savePriorityConfig(c);
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });
  const ro = !canEdit;
  const levels = [...c.levels].sort((a, b) => a.min - b.min);

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal pr-modal" role="dialog" aria-modal="true" aria-label="Prioridades dos territórios">
        <header><h2>Prioridades dos territórios</h2><button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button></header>
        <div className="pe-modal-body">
          <div className="pr-all">
            <div><b>{total} {total === 1 ? 'território' : 'territórios'}</b>{unscored > 0 && <span className="muted"> · {unscored} sem score</span>}<small>{!config.criteria.length ? 'Defina e salve os critérios para poder classificar.' : dirty ? 'Salve as mudanças antes de reclassificar.' : 'Aplica (ou reaplica) o score em todos os territórios.'}</small></div>
            <ReclassifyButton target={{ scope: 'all' }} count={total} label={unscored === total ? 'Classificar todos' : 'Reclassificar todos'} disabled={!hasKey || dirty || !config.criteria.length} />
          </div>

          <section className="pr-sec">
            <div className="pr-sec-head"><h3>Critérios</h3><span>O que pesa no score de 1 a 100</span>{!ro && <button type="button" className="btn small primary pr-ai" onClick={suggest} disabled={busy || !hasKey}>{busy ? 'Pensando…' : <><IconSpark /> {c.criteria.length ? 'Sugerir de novo com IA' : 'Sugerir critérios com IA'}</>}</button>}</div>
            {!ro && <details className="vd-more"><summary>Instruções para a IA <span className="muted">(opcional)</span></summary><textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={800} placeholder="Ex.: Pesar mais a urgência da dor e a chance de mobilizar a comunidade." /></details>}
            {busy && <div className="notice info" role="status">A IA está lendo o que a organização faz, o ICP e as personas. Leva uns 10 a 20 segundos.</div>}
            {note && <div className="notice info">{note}</div>}
            {c.criteria.length === 0 && !busy && <div className="pr-empty"><b>Nenhum critério ainda</b><p>Peça à IA para sugerir a partir do que a organização faz, ou crie à mão. Sem critérios, os territórios ficam sem score.</p></div>}
            <div className="pr-cards">
              {c.criteria.map((x) => (
                <div key={x.id} className="pr-card">
                  <div className="pr-card-top">
                    <input type="text" className="pr-name" value={x.name} maxLength={60} disabled={ro} onChange={(e) => setCrit(x.id, { name: e.target.value })} aria-label="Nome do critério" placeholder="Nome do critério" />
                    <div className="pr-weight" title="Peso do critério">
                      <input type="range" min={1} max={10} value={x.weight} disabled={ro} onChange={(e) => setCrit(x.id, { weight: Number(e.target.value) })} aria-label="Peso" />
                      <b>{Math.round((x.weight / wsum) * 100)}%</b>
                    </div>
                    {!ro && <button type="button" className="pr-x" onClick={() => setC((s) => ({ ...s, criteria: s.criteria.filter((k) => k.id !== x.id) }))} aria-label="Remover critério" title="Remover" disabled={c.criteria.length <= 1}>✕</button>}
                  </div>
                  <textarea className="pr-desc" rows={2} value={x.description} maxLength={240} disabled={ro} onChange={(e) => setCrit(x.id, { description: e.target.value })} aria-label="O que a IA deve avaliar" placeholder="O que a IA deve avaliar neste critério" />
                </div>
              ))}
            </div>
            {!ro && c.criteria.length < MAX_CRITERIA && <button type="button" className="btn small" onClick={() => setC((s) => ({ ...s, criteria: [...s.criteria, { id: uid(), name: '', description: '', weight: 3 }] }))}>+ Critério</button>}
          </section>

          <section className="pr-sec">
            <div className="pr-sec-head"><h3>Faixas de prioridade</h3><span>Nome e cor de cada nota</span></div>
            <div className="pr-scale" aria-hidden>
              {levels.map((l, i) => { const end = levels[i + 1]?.min ?? 101; return <i key={l.id} style={{ flex: Math.max(1, end - l.min), background: l.color }} title={`${l.name}: ${l.min}–${end - 1}`}>{end - l.min > 12 ? l.name : ''}</i>; })}
            </div>
            <div className="pr-scale-num"><span>1</span><span>100</span></div>
            <div className="pr-levels">
              {[...c.levels].sort((a, b) => b.min - a.min).map((x) => (
                <div key={x.id} className="pr-lvl">
                  <input type="color" value={x.color} disabled={ro} onChange={(e) => setLvl(x.id, { color: e.target.value })} aria-label="Cor" className="pr-color" />
                  <input type="text" className="pr-lvl-name" value={x.name} maxLength={30} disabled={ro} onChange={(e) => setLvl(x.id, { name: e.target.value })} aria-label="Nome da prioridade" placeholder="Ex.: Alta" />
                  <label className="pr-min">a partir de<input type="number" min={1} max={100} value={x.min} disabled={ro || x.min === 1} onChange={(e) => setLvl(x.id, { min: Number(e.target.value) })} /></label>
                  {!ro && <button type="button" className="pr-x" onClick={() => setC((s) => ({ ...s, levels: s.levels.filter((k) => k.id !== x.id) }))} aria-label="Remover faixa" title="Remover" disabled={x.min === 1}>✕</button>}
                </div>
              ))}
            </div>
            {!ro && c.levels.length < MAX_LEVELS && <button type="button" className="btn small" onClick={() => setC((s) => ({ ...s, levels: [...s.levels, { id: uid(), name: '', min: 50, color: '#1D9BF0' }] }))}>+ Faixa</button>}
          </section>

          {ro && <div className="notice info">Só administradores da marca editam critérios e faixas.</div>}
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          {!ro ? <button type="button" className="btn ghost" onClick={() => setC((s) => ({ ...s, criteria: [] }))} disabled={!c.criteria.length}>Limpar critérios</button> : <span />}
          <div className="row-actions">
            <button type="button" className="btn" onClick={onClose}>{ro ? 'Fechar' : 'Cancelar'}</button>
            {!ro && <button type="button" className="btn primary" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
