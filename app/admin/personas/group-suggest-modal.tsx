'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { addSuggestedGroups } from '@/lib/persona-actions';
import { IconSpark } from '../../icons';

const COUNTS = [2, 3, 4, 5, 6, 8];
type G = { name: string; description: string };

/** Gera grupos de personas (só os "segmentos", sem personas) com IA em 2 passos: 1) ICP, quantidade e instruções opcionais; 2) revisar o que entra. */
export function GroupSuggestModal({ initialIcp, existing, hasKey, onClose }: { initialIcp: string; existing: string[]; hasKey: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [icp, setIcp] = useState(initialIcp);
  const [count, setCount] = useState(4);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [groups, setGroups] = useState<G[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const selected = groups.filter((_, i) => !off.has(i)).length;

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/personas/groups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ icp, count, instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir grupos.');
      setGroups(j.groups); setOff(new Set()); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const add = () => start(async () => {
    const r = await addSuggestedGroups(groups.filter((_, i) => !off.has(i)));
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });
  const upd = (i: number, patch: Partial<G>) => setGroups((a) => a.map((g, k) => (k === i ? { ...g, ...patch } : g)));

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Gerar grupos de personas com IA">
        <header>
          <h2>{step === 'ask' ? 'Gerar grupos de personas com IA' : 'Revise os grupos sugeridos'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        {step === 'ask' ? (
          <>
            <div className="pe-modal-body">
              <p className="muted">A IA propõe os <b>grupos</b> (segmentos do seu público). Depois você cria as personas dentro de cada um, à mão ou com o botão de IA do grupo.</p>
              <div className="field">
                <label htmlFor="gicp">Seu ICP <span className="muted">· perfil de cliente ideal</span></label>
                <textarea id="gicp" rows={5} value={icp} onChange={(e) => setIcp(e.target.value)} maxLength={4000} placeholder="Quem é o seu público? Setor, momento de vida, o que busca, o que o trava… Quanto mais específico, melhores os grupos." />
              </div>
              <div className="field">
                <label>Quantos grupos?</label>
                <div className="vd-chips">{COUNTS.map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}</div>
              </div>
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Separe quem doa dinheiro de quem doa tempo. Inclua um grupo de parceiros institucionais." />
              </details>
              {existing.length > 0 && <div className="notice info">Já existem <b>{existing.length}</b> {existing.length === 1 ? 'grupo' : 'grupos'} ({existing.slice(0, 4).join(', ')}{existing.length > 4 ? '…' : ''}). A IA vai <b>evitar repetir</b> e cobrir o que falta.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está montando os grupos. Leva cerca de 10 a 25 segundos; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(0.01 + count * 0.004)} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={suggest} disabled={busy || !hasKey || (icp.trim().length < 20 && !initialIcp.trim())}>{busy ? 'Gerando…' : <><IconSpark /> Gerar {count} grupos</>}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="pe-modal-body">
              <p className="muted">Desmarque os que não quiser e ajuste nome e descrição.</p>
              <div className="id-review">
                {groups.map((g, i) => (
                  <div key={i} className={`id-rev${off.has(i) ? ' off' : ''}`}>
                    <input type="checkbox" checked={!off.has(i)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} aria-label={`Incluir ${g.name}`} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={g.name} maxLength={60} onChange={(e) => upd(i, { name: e.target.value })} aria-label="Nome do grupo" style={{ fontWeight: 700 }} />
                      <textarea rows={2} value={g.description} maxLength={200} onChange={(e) => upd(i, { description: e.target.value })} aria-label="Descrição do grupo" />
                    </div>
                  </div>
                ))}
              </div>
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <button type="button" className="btn ghost" onClick={() => setStep('ask')}>← Voltar</button>
              <div className="row-actions">
                <button type="button" className="btn" onClick={suggest} disabled={busy}>{busy ? 'Pensando…' : 'Sugerir outros'}</button>
                <button type="button" className="btn primary" onClick={add} disabled={pending || selected === 0}>{pending ? 'Adicionando…' : `Adicionar ${selected} ${selected === 1 ? 'grupo' : 'grupos'}`}</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
