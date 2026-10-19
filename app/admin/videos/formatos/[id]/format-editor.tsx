'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveFormat } from '@/lib/video-actions';
import { DURATION_PRESETS, MAX_PARTS, MAX_SECONDS, MIN_SECONDS, allocate, fmtSecs, wordsFor, type VideoPart } from '@/lib/video';
import { IconDown, IconPlus, IconTrash, IconUp } from '../../../../icons';
import { PartsBar } from '../../parts-bar';

type Initial = { id?: string; name: string; description: string; defaultSeconds: number; parts: VideoPart[] };
const uid = () => `p${Math.random().toString(36).slice(2, 8)}`;

export function FormatEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [seconds, setSeconds] = useState(initial.defaultSeconds);
  const [parts, setParts] = useState<VideoPart[]>(initial.parts);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(initial.parts[0]?.id ?? null);

  const secs = allocate(parts, seconds);
  const total = parts.reduce((a, p) => a + p.percent, 0) || 1;
  const set = (i: number, patch: Partial<VideoPart>) => setParts((a) => a.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const move = (i: number, d: -1 | 1) => setParts((a) => { const j = i + d; if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const add = () => { const p = { id: uid(), name: `Parte ${parts.length + 1}`, instruction: '', percent: 15 }; setParts((a) => [...a, p]); setOpen(p.id); };
  const remove = (i: number) => setParts((a) => (a.length > 1 ? a.filter((_, k) => k !== i) : a));
  const equalize = () => setParts((a) => a.map((p) => ({ ...p, percent: Math.round(100 / a.length) })));

  const save = () => {
    setErr('');
    start(async () => {
      const r = await saveFormat({ id: initial.id, name, description, defaultSeconds: seconds, parts });
      if (r.error) { setErr(r.error); return; }
      router.push('/admin/videos/formatos'); router.refresh();
    });
  };

  return (
    <div className="vd-editor">
      <div className="vd-sticky">
        <PartsBar parts={parts.map((p, i) => ({ name: p.name || '—', seconds: secs[i] }))} />
        <div className="vd-sticky-meta"><span>{parts.length} partes</span><i>·</i><span>{fmtSecs(seconds)} no total</span><i>·</i><span>~{wordsFor(seconds)} palavras de fala</span></div>
      </div>

      <div className="card-surface form-card">
        <div className="field"><label htmlFor="fn">Nome do formato</label><input id="fn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Mito vs. verdade" /></div>
        <div className="field"><label htmlFor="fd">Descrição <span className="muted">(opcional)</span></label><input id="fd" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Quando usar este formato" /></div>
        <div className="field">
          <label>Duração padrão</label>
          <div className="vd-chips">
            {DURATION_PRESETS.map((d) => <button key={d} type="button" className={`vd-chip${seconds === d ? ' on' : ''}`} onClick={() => setSeconds(d)}>{d}s</button>)}
            <label className="vd-custom">outra: <input type="number" min={MIN_SECONDS} max={MAX_SECONDS} value={seconds} onChange={(e) => setSeconds(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number(e.target.value) || MIN_SECONDS)))} /> s</label>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 26 }}><h2>Partes do vídeo</h2><button type="button" className="btn small ghost" onClick={equalize}>Dividir o tempo igualmente</button></div>
      <div className="vd-parts">
        {parts.map((p, i) => (
          <div key={p.id} className={`card-surface vd-part${open === p.id ? ' open' : ''}`}>
            <div className="vd-part-head" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span className="vd-num" style={{ background: `var(--vd-c${i % 10})` }}>{i + 1}</span>
              <input className="vd-part-name" value={p.name} onClick={(e) => e.stopPropagation()} onChange={(e) => set(i, { name: e.target.value })} maxLength={60} aria-label={`Nome da parte ${i + 1}`} />
              <span className="vd-part-time">{fmtSecs(secs[i])} · ~{wordsFor(secs[i])} palavras</span>
              <div className="vd-part-tools" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima"><IconUp /></button>
                <button type="button" className="btn small ghost" onClick={() => move(i, 1)} disabled={i === parts.length - 1} aria-label="Mover para baixo"><IconDown /></button>
                <button type="button" className="btn small ghost danger" onClick={() => remove(i)} disabled={parts.length === 1} aria-label="Remover parte"><IconTrash /></button>
              </div>
            </div>
            {open === p.id && (
              <div className="vd-part-body">
                <div className="field">
                  <label htmlFor={`pi${i}`}>Instruções para a IA nesta parte</label>
                  <textarea id={`pi${i}`} rows={5} value={p.instruction} maxLength={1500} onChange={(e) => set(i, { instruction: e.target.value })}
                    placeholder="Diga o que acontece aqui, o tom, o que evitar e como terminar. Ex.: Abra com uma pergunta direta. Nada de apresentação. A primeira frase precisa fazer sentido sozinha." />
                  <small className="muted">{p.instruction.length}/1500 · Descreva a função da parte, o tom e o que NÃO fazer.</small>
                </div>
                <div className="field">
                  <label htmlFor={`pp${i}`}>Tempo desta parte: <b>{Math.round((p.percent / total) * 100)}%</b> do vídeo</label>
                  <input id={`pp${i}`} type="range" min={1} max={100} value={p.percent} onChange={(e) => set(i, { percent: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </div>
        ))}
        {parts.length < MAX_PARTS && <button type="button" className="vd-add" onClick={add}><IconPlus /> Adicionar parte</button>}
      </div>

      {err && <div className="notice err" style={{ marginTop: 16 }}>{err}</div>}
      <div className="gen-foot">
        <span className="muted">As alterações valem para os próximos roteiros. Os já gerados não mudam.</span>
        <button type="button" className="btn primary" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar formato'}</button>
      </div>
    </div>
  );
}
