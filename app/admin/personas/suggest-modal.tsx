'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import type { SuggestedGroup } from '@/lib/ai/persona';
import { ESTIMATED_COST_PER_PERSONA, ESTIMATED_COST_PERSONA_BASE, MAX_PERSONAS_PER_RUN, normName } from '@/lib/persona';
import { addSuggested } from '@/lib/persona-actions';
import { IconSpark } from '../../icons';

const COUNTS = [1, 2, 3, 5, 8, 12];

/** Gera personas com IA em 2 passos: 1) ICP e quantidade; 2) revisar o que entra no quadro. */
export function SuggestModal({ initialIcp, existingCount, groupNames, hasKey, onClose }: { initialIcp: string; existingCount: number; groupNames: string[]; hasKey: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [icp, setIcp] = useState(initialIcp);
  const [count, setCount] = useState(5);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [groups, setGroups] = useState<SuggestedGroup[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set()); // "g:p" desmarcadas
  const [open, setOpen] = useState<string | null>(null);

  const existing = useMemo(() => new Set(groupNames.map(normName)), [groupNames]);
  const selected = groups.reduce((n, g, gi) => n + g.personas.filter((_, pi) => !off.has(`${gi}:${pi}`)).length, 0);

  async function suggest() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/personas/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ icp, count, instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir personas.');
      setGroups(j.groups); setOff(new Set()); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const add = () => {
    const chosen = groups.map((g, gi) => ({ ...g, personas: g.personas.filter((_, pi) => !off.has(`${gi}:${pi}`)) })).filter((g) => g.personas.length);
    start(async () => {
      const r = await addSuggested(chosen);
      if (r.error) { setErr(r.error); return; }
      router.refresh(); onClose();
    });
  };
  const toggle = (k: string) => setOff((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Sugerir personas com IA">
        <header>
          <h2>{step === 'ask' ? 'Sugerir personas com IA' : 'Revise as personas sugeridas'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {step === 'ask' ? (
          <>
            <div className="pe-modal-body">
              <div className="field">
                <label htmlFor="icp">Seu ICP <span className="muted">· perfil de cliente ideal</span></label>
                <textarea id="icp" rows={7} value={icp} onChange={(e) => setIcp(e.target.value)} maxLength={4000}
                  placeholder="Quem é o seu cliente ideal? Setor, porte, cargo, momento de vida ou do negócio, o que busca, o que o trava, onde consome conteúdo… Quanto mais específico, melhores as personas." />
              </div>
              <div className="field">
                <label>Quantas personas?</label>
                <div className="vd-chips">
                  {COUNTS.map((n) => <button key={n} type="button" className={`vd-chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}
                  <label className="vd-custom">outra: <input type="number" min={1} max={MAX_PERSONAS_PER_RUN} value={count} onChange={(e) => setCount(Math.min(MAX_PERSONAS_PER_RUN, Math.max(1, Number(e.target.value) || 1)))} /></label>
                </div>
              </div>
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Foque em quem já comprou de concorrentes. Inclua pelo menos uma persona decisora e uma influenciadora." />
              </details>
              {existingCount > 0 && <div className="notice info">Já existem <b>{existingCount}</b> {existingCount === 1 ? 'persona' : 'personas'} no quadro. A IA vai considerá-las para <b>não repetir</b> perfis e, quando fizer sentido, encaixar as novas nos grupos existentes.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está criando as personas. Isso leva cerca de {count <= 5 ? '30 a 60 segundos' : '1 a 2 minutos'}; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(ESTIMATED_COST_PERSONA_BASE + count * ESTIMATED_COST_PER_PERSONA)} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={suggest} disabled={busy || icp.trim().length < 20 || !hasKey}>{busy ? 'Criando personas…' : <><IconSpark /> Sugerir {count} {count === 1 ? 'persona' : 'personas'}</>}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="pe-modal-body">
              <p className="muted">Desmarque as que não quiser e ajuste o nome dos grupos. As aprovadas entram no quadro.</p>
              {groups.map((g, gi) => (
                <section key={gi} className="pe-sug-group">
                  <div className="pe-sug-head">
                    <input value={g.name} onChange={(e) => setGroups((a) => a.map((x, k) => (k === gi ? { ...x, name: e.target.value } : x)))} maxLength={60} aria-label="Nome do grupo" />
                    <span className={`pill ${existing.has(normName(g.name)) ? 'published' : ''}`}>{existing.has(normName(g.name)) ? 'Grupo existente' : 'Grupo novo'}</span>
                  </div>
                  {g.description && <small className="muted">{g.description}</small>}
                  {g.personas.map((p, pi) => {
                    const k = `${gi}:${pi}`;
                    return (
                      <div key={k} className={`pe-sug${off.has(k) ? ' off' : ''}`}>
                        <label className="pe-sug-main">
                          <input type="checkbox" checked={!off.has(k)} onChange={() => toggle(k)} />
                          <span><b>{p.name}</b><small>{[p.data.role, p.data.age].filter(Boolean).join(' · ')}</small><em>{p.tagline}</em></span>
                        </label>
                        <button type="button" className="vd-link" onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Ocultar' : 'Detalhes'}</button>
                        {open === k && (
                          <div className="pe-sug-det">
                            {p.data.bio && <p>{p.data.bio}</p>}
                            {p.data.pains.length > 0 && <p><b>Dores:</b> {p.data.pains.join(' · ')}</p>}
                            {p.data.goals.length > 0 && <p><b>Objetivos:</b> {p.data.goals.join(' · ')}</p>}
                            {p.data.triggers.length > 0 && <p><b>Gatilhos:</b> {p.data.triggers.join(' · ')}</p>}
                            {p.data.channels.length > 0 && <p><b>Onde está:</b> {p.data.channels.join(' · ')}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <button type="button" className="btn ghost" onClick={() => setStep('ask')}>← Voltar</button>
              <div className="row-actions">
                <button type="button" className="btn" onClick={suggest} disabled={busy}>{busy ? 'Pensando…' : 'Sugerir outras'}</button>
                <button type="button" className="btn primary" onClick={add} disabled={pending || selected === 0}>{pending ? 'Adicionando…' : `Adicionar ${selected} ${selected === 1 ? 'persona' : 'personas'} ao quadro`}</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
