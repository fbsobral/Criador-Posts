'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { ESTIMATED_COST_PER_SCORED } from '@/lib/priority';

export type ReclassifyScope = { scope: 'all' } | { scope: 'persona'; personaId: string } | { scope: 'node'; nodeId: string };

/** Reclassifica o score dos territórios do escopo (marca toda, um mapa ou um território e seus filhos). Pede confirmação e mostra o custo estimado. */
export function ReclassifyButton({ target, count, label, className = 'btn small', disabled, onError }: {
  target: ReclassifyScope; count: number; label: string; className?: string; disabled?: boolean; onError?: (m: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    if (!confirm(`Reclassificar ${count} ${count === 1 ? 'território' : 'territórios'} com IA?\nIsso substitui os scores atuais (inclusive os que você ajustou à mão). Custo estimado: ${fmtUsd(0.01 + count * ESTIMATED_COST_PER_SCORED)}.`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/territories/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(target) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível classificar.');
      setMsg(`✓ ${j.updated} classificados`); setTimeout(() => setMsg(''), 3500);
      router.refresh();
    } catch (e) { const m = e instanceof Error ? e.message : 'Erro inesperado.'; setMsg(''); onError ? onError(m) : alert(m); } finally { setBusy(false); }
  }
  return <button type="button" className={className} onClick={run} disabled={busy || disabled || count === 0} title="Calcula o score (1 a 100) pelos critérios de prioridade">{busy ? 'Classificando…' : msg || label}</button>;
}
