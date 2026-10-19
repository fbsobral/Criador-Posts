'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteScript, duplicateScript, saveScript } from '@/lib/video-actions';
import { PART_COLORS, PLATFORMS, STAGES, countWords, fmtSecs, scriptToText, speakSeconds, stageOf, wordsFor, type ScriptData, type Stage } from '@/lib/video';
import { IconCopy, IconPlay, IconTrash } from '../../../icons';
import { PartsBar } from '../parts-bar';

type Meta = { formatName: string; seconds: number; platform: string; angle: string };
type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export function ScriptEditor({ id, initialTitle, initialStatus, data: initial, meta }: { id: string; initialTitle: string; initialStatus: Stage; data: ScriptData; meta: Meta }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<ScriptData>(initial);
  const [save, setSave] = useState<SaveState>('saved');
  const [copied, setCopied] = useState(false);
  const [prompter, setPrompter] = useState(false);
  const first = useRef(true);
  const latest = useRef({ title, status, data });
  latest.current = { title, status, data };

  const flush = useCallback(async () => {
    setSave('saving');
    const r = await saveScript({ id, ...latest.current });
    setSave(r.error ? 'error' : 'saved');
  }, [id]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSave('dirty');
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [title, status, data, flush]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save]);

  const setPart = (i: number, patch: Partial<ScriptData['parts'][number]>) => setData((d) => ({ ...d, parts: d.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  const spoken = data.parts.reduce((a, p) => a + speakSeconds(p.speech), 0);
  const ratio = spoken / meta.seconds;
  const timing = ratio > 1.12 ? 'over' : ratio < 0.7 ? 'under' : 'ok';
  const platform = PLATFORMS.find((p) => p.id === meta.platform)?.label ?? 'Reels';

  const copy = async () => { try { await navigator.clipboard.writeText(scriptToText(title, data)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sem permissão de área de transferência */ } };
  const dup = async () => { const r = await duplicateScript(id); if (r.id) router.push(`/admin/videos/${r.id}`); };
  const del = async () => { if (!confirm('Excluir este roteiro?')) return; await deleteScript(id); router.push('/admin/videos'); router.refresh(); };

  return (
    <div className="vd-script">
      <div className="vd-script-head">
        <input className="vd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Título do roteiro" />
        <div className="vd-script-actions">
          <span className={`vd-save ${save}`}>{save === 'saved' ? 'Salvo' : save === 'error' ? 'Erro ao salvar' : 'Salvando…'}</span>
          <select className="vd-stage-select" value={status} onChange={(e) => setStatus(e.target.value as Stage)} style={{ '--c': stageOf(status).color } as React.CSSProperties} aria-label="Etapa do vídeo">
            {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
          </select>
          <button type="button" className="btn small" onClick={copy}><IconCopy /> {copied ? 'Copiado!' : 'Copiar'}</button>
          <button type="button" className="btn small" onClick={() => setPrompter(true)}><IconPlay /> Teleprompter</button>
          <button type="button" className="btn small" onClick={dup}>Duplicar</button>
          <button type="button" className="btn small ghost danger" onClick={del} aria-label="Excluir roteiro"><IconTrash /></button>
        </div>
      </div>

      <div className="vd-meta big"><span>{meta.formatName || 'Formato'}</span><i>·</i><span>{fmtSecs(meta.seconds)}</span><i>·</i><span>{platform}</span></div>
      {meta.angle && <p className="vd-angle"><b>Ideia:</b> {meta.angle}</p>}

      <div className="card-surface vd-timing">
        <PartsBar parts={data.parts} />
        <div className={`vd-timing-msg ${timing}`}>
          <b>~{fmtSecs(spoken)} de fala</b> para {fmtSecs(meta.seconds)} de vídeo ·{' '}
          {timing === 'ok' ? 'cabe no tempo.' : timing === 'over' ? 'passa do tempo: corte algumas palavras.' : 'sobra tempo: dá para falar um pouco mais.'}
        </div>
      </div>

      {data.notes.length > 0 && (
        <div className="notice warn vd-notes"><b>Conferir antes de gravar</b><ul>{data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
      )}

      <div className="vd-script-parts">
        {data.parts.map((p, i) => {
          const w = countWords(p.speech), lim = wordsFor(p.seconds);
          return (
            <section key={i} className="card-surface vd-sp">
              <header>
                <span className="vd-num" style={{ background: PART_COLORS[i % PART_COLORS.length] }}>{i + 1}</span>
                <b>{p.name}</b>
                <span className="vd-sp-time">{fmtSecs(p.seconds)}</span>
                <span className={`vd-words${w > lim * 1.15 ? ' over' : ''}`}>{w}/{lim} palavras</span>
              </header>
              <div className="field"><label htmlFor={`s${i}`}>Fala</label>
                <textarea id={`s${i}`} className="vd-speech" rows={Math.max(3, Math.ceil(p.speech.length / 70))} value={p.speech} onChange={(e) => setPart(i, { speech: e.target.value })} /></div>
              <div className="vd-sp-row">
                <div className="field"><label htmlFor={`o${i}`}>Texto na tela</label><input id={`o${i}`} value={p.onScreen} onChange={(e) => setPart(i, { onScreen: e.target.value })} maxLength={200} /></div>
                <div className="field"><label htmlFor={`v${i}`}>Visual / o que mostrar</label><textarea id={`v${i}`} rows={2} value={p.visual} onChange={(e) => setPart(i, { visual: e.target.value })} /></div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="card-surface form-card vd-cap">
        <div className="field"><label htmlFor="cap">Legenda</label><textarea id="cap" rows={3} value={data.caption} onChange={(e) => setData((d) => ({ ...d, caption: e.target.value }))} maxLength={2200} /></div>
        <div className="field"><label htmlFor="tags">Hashtags <span className="muted">(separadas por espaço)</span></label>
          <input id="tags" value={data.hashtags.map((h) => `#${h}`).join(' ')} onChange={(e) => setData((d) => ({ ...d, hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, '')).filter(Boolean) }))} /></div>
      </div>

      {prompter && <Teleprompter parts={data.parts} onClose={() => setPrompter(false)} />}
    </div>
  );
}

/** Tela cheia com a fala rolando sozinha, para gravar lendo. */
function Teleprompter({ parts, onClose }: { parts: ScriptData['parts']; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(40); // px por segundo
  const [size, setSize] = useState(46);
  const speedRef = useRef(speed); speedRef.current = speed;

  useEffect(() => {
    if (!play) return;
    let raf = 0, last = performance.now(), pos = box.current?.scrollTop ?? 0;
    const tick = (t: number) => {
      const el = box.current; if (!el) return;
      pos += ((t - last) / 1000) * speedRef.current; last = t;
      el.scrollTop = pos;
      if (pos < el.scrollHeight - el.clientHeight) raf = requestAnimationFrame(tick); else setPlay(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); setPlay((p) => !p); } };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="vd-prompter" role="dialog" aria-modal="true" aria-label="Teleprompter">
      <div className="vd-prompter-bar">
        <button type="button" className="btn small" onClick={() => setPlay((p) => !p)}>{play ? '❚❚ Pausar' : '▶ Rolar'}</button>
        <label>Velocidade <input type="range" min={10} max={140} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
        <label>Tamanho <input type="range" min={28} max={90} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
        <span className="muted">Espaço pausa · Esc fecha</span>
        <button type="button" className="btn small" onClick={onClose}>Fechar</button>
      </div>
      <div className="vd-prompter-text" ref={box} style={{ fontSize: size }}>
        <div className="vd-prompter-pad" />
        {parts.map((p, i) => (
          <div key={i} className="vd-prompter-part"><small>{p.name}</small><p>{p.speech}</p></div>
        ))}
        <div className="vd-prompter-pad" />
      </div>
    </div>
  );
}
