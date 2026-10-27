'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteScript, duplicateScript, saveScript } from '@/lib/video-actions';
import { PART_COLORS, PLATFORMS, STAGES, countWords, fmtSecs, scriptToText, speakSeconds, stageOf, wordsFor, type ScriptData, type Stage } from '@/lib/video';
import { IconCopy, IconPlay, IconSpark, IconTrash } from '../../../icons';
import { PartsBar } from '../parts-bar';

type Meta = { formatName: string; seconds: number; platform: string; angle: string };
type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export function ScriptEditor({ id, initialTitle, initialStatus, data: initial, meta, hasKey = true }: { id: string; initialTitle: string; initialStatus: Stage; data: ScriptData; meta: Meta; hasKey?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<ScriptData>(initial);
  const [save, setSave] = useState<SaveState>('saved');
  const [copied, setCopied] = useState(false);
  const [prompter, setPrompter] = useState(false);
  // refinar com IA: pedir → comparar → aplicar (com opção de desfazer, porque o editor salva sozinho)
  const [refine, setRefine] = useState(false);
  const [scope, setScope] = useState<number | null>(null);
  const [fb, setFb] = useState('');
  const [firstFb, setFirstFb] = useState('');
  const [fb2, setFb2] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [sugg, setSugg] = useState<{ title: string; data: ScriptData; note: string } | null>(null);
  const [undo, setUndo] = useState<{ title: string; data: ScriptData } | null>(null);
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

  const CHIPS = ['Mais curto', 'Gancho mais forte', 'Fala mais natural', 'Visual mais simples de gravar', 'CTA mais suave'];
  async function askRefine(feedback: string, previous?: { title: string; data: ScriptData }) {
    setRbusy(true); setRerr('');
    try {
      const r = await fetch('/api/videos/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, title, current: data, feedback, scope, previous }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar o roteiro.');
      setSugg(j); setFb2('');
    } catch (e) { setRerr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setRbusy(false); }
  }
  const changes = (() => {
    if (!sugg) return [] as { label: string; before: string; after: string }[];
    const out: { label: string; before: string; after: string }[] = [];
    if (sugg.title.trim() !== title.trim()) out.push({ label: 'Título', before: title, after: sugg.title });
    sugg.data.parts.forEach((p, k) => {
      const c = data.parts[k];
      if (p.speech.trim() !== c.speech.trim()) out.push({ label: `${k + 1}. ${p.name} · Fala`, before: c.speech, after: p.speech });
      if (p.onScreen.trim() !== c.onScreen.trim()) out.push({ label: `${k + 1}. ${p.name} · Texto na tela`, before: c.onScreen, after: p.onScreen });
      if (p.visual.trim() !== c.visual.trim()) out.push({ label: `${k + 1}. ${p.name} · Visual`, before: c.visual, after: p.visual });
    });
    if (sugg.data.caption.trim() !== data.caption.trim()) out.push({ label: 'Legenda', before: data.caption, after: sugg.data.caption });
    if (sugg.data.hashtags.join(' ') !== data.hashtags.join(' ')) out.push({ label: 'Hashtags', before: data.hashtags.map((h) => `#${h}`).join(' '), after: sugg.data.hashtags.map((h) => `#${h}`).join(' ') });
    return out;
  })();
  const applyRefined = () => {
    if (!sugg) return;
    setUndo({ title, data }); setTitle(sugg.title); setData(sugg.data);
    setSugg(null); setRefine(false); setFb(''); setFirstFb(''); setScope(null);
  };
  const undoRefine = () => { if (!undo) return; setTitle(undo.title); setData(undo.data); setUndo(null); };

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
          <button type="button" className="btn small" onClick={() => setRefine((o) => !o)} disabled={!hasKey} aria-expanded={refine}><IconSpark /> Refinar com IA</button>
          <button type="button" className="btn small" onClick={() => setPrompter(true)}><IconPlay /> Teleprompter</button>
          <button type="button" className="btn small" onClick={dup}>Duplicar</button>
          <button type="button" className="btn small ghost danger" onClick={del} aria-label="Excluir roteiro"><IconTrash /></button>
        </div>
      </div>

      {undo && <div className="notice info vd-undo">Refinamento aplicado e salvo. <button type="button" className="btn small" onClick={undoRefine}>↶ Desfazer</button></div>}
      {refine && (
        <div className="pe-refine vd-refine">
          <div className="pe-refine-head"><b>Refinar roteiro com IA</b><button type="button" className="btn small ghost" onClick={() => { setRefine(false); setSugg(null); setRerr(''); }}>Fechar</button></div>
          {!sugg ? (
            <>
              <p className="muted">Diga o que mudar. A IA propõe a versão ajustada, você compara e só aplica se gostar (e pode desfazer depois).</p>
              <div className="vd-chips" role="group" aria-label="O que refinar">
                <button type="button" className={`vd-chip${scope === null ? ' on' : ''}`} onClick={() => setScope(null)}>Roteiro inteiro</button>
                {data.parts.map((p, k) => <button key={k} type="button" className={`vd-chip${scope === k ? ' on' : ''}`} onClick={() => setScope(k)}>{k + 1}. {p.name}</button>)}
              </div>
              <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={800} placeholder="Ex.: o gancho está fraco, comece com a dor; corte as frases longas; deixe a CTA mais natural…" />
              <div className="aim-chips pe-chips-row">{CHIPS.map((c) => <button type="button" key={c} onClick={() => setFb((t) => (t.trim() ? `${t.trim()}; ` : '') + c.toLowerCase())}>{c}</button>)}</div>
              {rerr && <div className="notice err">{rerr}</div>}
              {rbusy && <div className="notice info" role="status">Refinando o roteiro… leva cerca de 15 a 40 segundos.</div>}
              <button type="button" className="btn primary" onClick={() => { setFirstFb(fb.trim()); askRefine(fb); }} disabled={rbusy || fb.trim().length < 3}>{rbusy ? 'Refinando…' : <><IconSpark /> Sugerir refinamento</>}</button>
            </>
          ) : (
            <>
              {sugg.note && <p className="pe-note">{sugg.note}</p>}
              {changes.length === 0 ? <p className="muted">A IA não mudou nada. Tente pedir de outro jeito.</p> : (
                <div className="pe-diff">
                  {changes.map((c, i) => <div key={i} className="pe-diff-row"><b>{c.label}</b>{c.before && <s>{c.before}</s>}<span>{c.after || '(vazio)'}</span></div>)}
                </div>
              )}
              {rerr && <div className="notice err">{rerr}</div>}
              <div className="pe-refine-actions">
                <button type="button" className="btn primary" onClick={applyRefined} disabled={changes.length === 0}>✓ Aplicar no roteiro</button>
                <button type="button" className="btn ghost" onClick={() => { setSugg(null); setRerr(''); }}>Descartar</button>
              </div>
              <div className="aim-fb">
                <b style={{ fontSize: 13 }}>Não é bem isso? Peça outro ajuste</b>
                <textarea rows={2} value={fb2} onChange={(e) => setFb2(e.target.value)} maxLength={800} placeholder="Ex.: ainda está longo; mantenha o gancho como estava…" />
                <button type="button" className="btn" onClick={() => askRefine(`${firstFb}\n(Novo pedido sobre a sugestão anterior): ${fb2.trim()}`, { title: sugg.title, data: sugg.data })} disabled={rbusy || fb2.trim().length < 3}>{rbusy ? 'Refinando…' : '↻ Ajustar de novo'}</button>
              </div>
            </>
          )}
        </div>
      )}

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
