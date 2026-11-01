'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { saveTranslations } from '@/lib/territory-actions';
import { splitPersonaName } from '@/lib/persona';
import { IconSpark } from '../../icons';
import type { PersonaLite } from './mind-map';

const COST_BASE = 0.01, COST_PER_PERSONA = 0.006;
const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/** Traduz um território para o dia a dia das personas, em 2 passos: 1) quais personas; 2) revisar e editar cada tradução antes de salvar. */
export function TranslateModal({ node, personas, linked, translated, preselect, hasKey, hasAbout, onClose, onSaved }: {
  node: { id: string; name: string; path: string }; personas: PersonaLite[]; /** personas que já enxergam o tema */ linked: string[]; /** personas que já têm tradução (própria ou herdada) */ translated: string[]; preselect?: string[];
  hasKey: boolean; hasAbout: boolean; onClose: () => void; onSaved?: (items: { personaId: string; translation: string }[]) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState<Set<string>>(new Set(preselect?.length ? preselect : linked.filter((id) => !translated.includes(id))));
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState<'ask' | 'review'>('ask');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<{ personaId: string; translation: string }[]>([]);
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nameOf = (id: string) => personas.find((p) => p.id === id)?.name ?? '';
  const colorOf = (id: string) => personas.find((p) => p.id === id)?.color ?? '#8A857A';
  const ordered = [...personas].sort((a, b) => Number(linked.includes(b.id)) - Number(linked.includes(a.id)));

  async function run() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/territories/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ territoryId: node.id, personaIds: [...pick], instructions }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível traduzir o território.');
      setItems(j.items); setStep('review');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const save = () => start(async () => {
    const keep = items.filter((x) => x.translation.trim());
    const r = await saveTranslations(node.id, keep.map((x) => ({ ...x, source: 'ai' as const })));
    if (r.error) { setErr(r.error); return; }
    onSaved?.(keep); router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Traduzir território para as personas">
        <header>
          <h2>{step === 'ask' ? 'Traduzir para as personas' : 'Revise as traduções'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        {step === 'ask' ? (
          <>
            <div className="pe-modal-body">
              <p className="muted">Tema: <b>{node.path}</b>. A IA escreve como esse tema aparece no <b>dia a dia</b> de cada persona. É a ponte entre o debate coletivo e a dor em linguagem de rua que vira ideia de conteúdo.</p>
              <div className="field">
                <label>Para quais personas?</label>
                <div className="tr-pick-list">
                  {ordered.map((p) => {
                    const sp = splitPersonaName(p.name);
                    return (
                      <label key={p.id} className={`tr-pick${pick.has(p.id) ? ' on' : ''}`}>
                        <input type="checkbox" checked={pick.has(p.id)} onChange={() => toggle(p.id)} />
                        <span className="pe-av sm" style={{ background: p.color ?? '#8A857A' }}>{initialsOf(p.name)}</span>
                        <span className="tr-tab-name"><b>{sp.first}</b>{sp.label && <small>{sp.label}</small>}</span>
                        <em>{translated.includes(p.id) ? 'já traduzido (será substituído)' : linked.includes(p.id) ? 'ligada, sem tradução' : 'ainda não ligada'}</em>
                      </label>
                    );
                  })}
                </div>
                {personas.length === 0 && <small className="muted">Crie personas primeiro.</small>}
              </div>
              <details className="vd-more">
                <summary>Instruções extras <span className="muted">(opcional)</span></summary>
                <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: Mostre como isso aparece na hora de pagar as contas do mês." />
              </details>
              <div className="notice info">As personas escolhidas passam a <b>enxergar este tema</b> (e os filhos dele). Nada é salvo antes da sua revisão.</div>
              {!hasAbout && <div className="notice warn">Você ainda não descreveu <b>o que a organização faz</b>. Sem isso, a ponte com a organização fica genérica.</div>}
              {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
              {busy && <div className="notice info" role="status">A IA está traduzindo o tema. Leva cerca de 10 a 40 segundos; mantenha esta janela aberta.</div>}
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <span className="muted">≈ {fmtUsd(COST_BASE + pick.size * COST_PER_PERSONA)} · nada é salvo antes da sua aprovação</span>
              <button type="button" className="btn primary" onClick={run} disabled={busy || !hasKey || pick.size === 0}>{busy ? 'Traduzindo…' : <><IconSpark /> Traduzir ({pick.size})</>}</button>
            </footer>
          </>
        ) : (
          <>
            <div className="pe-modal-body">
              <p className="muted">Edite o que quiser. Deixe vazio para não salvar a tradução daquela persona.</p>
              <div className="tr-tr-review">
                {items.map((x, i) => (
                  <div key={x.personaId} className="field">
                    <label htmlFor={`tr${i}`}><span className="pe-av sm" style={{ background: colorOf(x.personaId), marginRight: 6 }}>{initialsOf(nameOf(x.personaId))}</span>{nameOf(x.personaId)}</label>
                    <textarea id={`tr${i}`} rows={4} maxLength={1200} value={x.translation} onChange={(e) => setItems((a) => a.map((y, j) => (j === i ? { ...y, translation: e.target.value } : y)))} />
                  </div>
                ))}
              </div>
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <button type="button" className="btn ghost" onClick={() => setStep('ask')}>← Voltar</button>
              <div className="row-actions">
                <button type="button" className="btn" onClick={run} disabled={busy}>{busy ? 'Pensando…' : 'Traduzir de novo'}</button>
                <button type="button" className="btn primary" onClick={save} disabled={pending || !items.some((x) => x.translation.trim())}>{pending ? 'Salvando…' : 'Salvar traduções'}</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
