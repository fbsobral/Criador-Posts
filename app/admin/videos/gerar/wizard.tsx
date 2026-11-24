'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtUsd } from '@/lib/ai/constants';
import { DURATION_PRESETS, ESTIMATED_COST_PER_SCRIPT, MAX_CONTENT_CHARS, MAX_SECONDS, MIN_SECONDS, countWords, wordsFor } from '@/lib/video';
import { IconSpark } from '../../../icons';

const WRITING = ['Lendo o material…', 'Escolhendo como o vídeo começa…', 'Escrevendo a fala…', 'Pensando no que aparece na tela…', 'Afinando o convite final…', 'Organizando os blocos…'];

/** Gerar roteiro: o material, a duração e (opcional) um pedido. A IA escreve livre, como num chat; sem formatos. */
export function Wizard({ hasKey, remaining }: { hasKey: boolean; remaining: number }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const words = useMemo(() => countWords(content), [content]);
  const tooShort = content.trim().length < 20;

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((n) => n + 1), 3500);
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => { clearInterval(t); window.removeEventListener('beforeunload', h); };
  }, [busy]);

  async function write() {
    setBusy(true); setErr(''); setTick(0);
    try {
      const r = await fetch('/api/videos/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, seconds, instructions, platform: 'all' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível escrever o roteiro.');
      router.push(`/admin/videos/${j.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); setBusy(false); }
  }

  return (
    <div className="vd-wiz vd-simple">
      {!hasKey && <div className="notice warn" style={{ marginBottom: 16 }}>A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
      {remaining <= 0 && <div className="notice err" style={{ marginBottom: 16 }}>O limite diário de roteiros da marca foi atingido. Tente amanhã.</div>}

      <div className="card-surface form-card">
        <div className="field">
          <label htmlFor="vc">Sobre o que é o vídeo?</label>
          <textarea id="vc" rows={14} value={content} onChange={(e) => setContent(e.target.value)} disabled={busy}
            placeholder="Cole o material ou escreva o assunto: dados, anotações, um texto, uma ideia. Números e fontes que estiverem aqui podem entrar no vídeo." />
          <div className="vd-count"><span>{words.toLocaleString('pt-BR')} palavras</span>{content.length > MAX_CONTENT_CHARS && <span className="vd-err">· passa de {MAX_CONTENT_CHARS.toLocaleString('pt-BR')} caracteres; o excesso será ignorado</span>}</div>
        </div>
        <div className="field">
          <div className="lbl">Duração</div>
          <div className="vd-chips">
            {DURATION_PRESETS.map((d) => <button key={d} type="button" className={`vd-chip${seconds === d ? ' on' : ''}`} onClick={() => setSeconds(d)} disabled={busy}>{d}s</button>)}
            <label className="vd-custom">outra: <input type="number" min={MIN_SECONDS} max={MAX_SECONDS} value={seconds} disabled={busy} onChange={(e) => setSeconds(Math.min(MAX_SECONDS, Math.round(Number(e.target.value)) || 0))} onBlur={() => setSeconds((v) => Math.max(MIN_SECONDS, v))} /> s</label>
          </div>
          <small className="muted">≈ {wordsFor(seconds)} palavras de fala</small>
        </div>
        <details className="vd-more">
          <summary>Pedido extra <span className="muted">(opcional)</span></summary>
          <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1500} disabled={busy} placeholder="Ex.: tom mais emocional; termine convidando a se inscrever; fale com os pais dos jovens." />
        </details>
      </div>

      {busy && <div className="card-surface vd-progress"><b>{WRITING[tick % WRITING.length]}</b><small className="muted">Leva cerca de um minuto. Mantenha esta aba aberta.</small></div>}
      {err && <div className="notice err">{err}</div>}
      <div className="gen-foot vd-foot">
        <span className="muted">Custa ≈ {fmtUsd(ESTIMATED_COST_PER_SCRIPT)}. Você edita tudo depois.</span>
        <button type="button" className="btn primary" onClick={write} disabled={busy || tooShort || !hasKey || remaining <= 0}>
          {busy ? 'Escrevendo…' : <><IconSpark /> Escrever o roteiro</>}
        </button>
      </div>
    </div>
  );
}
