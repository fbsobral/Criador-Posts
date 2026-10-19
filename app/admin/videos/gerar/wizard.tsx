'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import {
  DURATION_PRESETS, ESTIMATED_COST_PER_SCRIPT, ESTIMATED_COST_PLAN, MAX_CONTENT_CHARS, MAX_SECONDS, MAX_VIDEO_IDEAS, MIN_SECONDS, PLATFORMS,
  allocate, countWords, fmtSecs, wordsFor, type Platform, type VideoIdea, type VideoPart,
} from '@/lib/video';
import { IconBack, IconPlus, IconSpark, IconTrash } from '../../../icons';
import { PartsBar } from '../parts-bar';

type Format = { id: string; name: string; description: string; defaultSeconds: number; parts: VideoPart[]; own: boolean };
type Item = { idea: VideoIdea; status: 'wait' | 'run' | 'done' | 'err'; id?: string; title?: string; error?: string };

const CONCURRENCY = 3;
const STEPS = ['Conteúdo e formato', 'Ideias', 'Roteiros'];

export function Wizard({ formats, hasKey, remaining, canEditFormats }: { formats: Format[]; hasKey: boolean; remaining: number; canEditFormats: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [content, setContent] = useState('');
  const [formatId, setFormatId] = useState(formats[0]?.id ?? '');
  const format = formats.find((f) => f.id === formatId);
  const [seconds, setSeconds] = useState(formats[0]?.defaultSeconds ?? 45);
  const [platform, setPlatform] = useState<Platform>('reels');
  const [count, setCount] = useState(3);
  const [instructions, setInstructions] = useState('');
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [feedback, setFeedback] = useState('');
  const [running, setRunning] = useState(false);
  const batch = useRef('');

  const words = useMemo(() => countWords(content), [content]);
  const suggested = Math.min(MAX_VIDEO_IDEAS, Math.max(1, Math.round(words / 350)));
  const tooShort = content.trim().length < 40;
  const over = content.length > MAX_CONTENT_CHARS;
  const secs = format ? allocate(format.parts, seconds) : [];
  const maxCount = Math.min(MAX_VIDEO_IDEAS, remaining);

  useEffect(() => { if (words > 0 && count === 3) setCount(Math.min(suggested, maxCount) || 1); /* sugere uma vez, ao colar */ }, [words > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [running]);

  const pickFormat = (f: Format) => { setFormatId(f.id); setSeconds(f.defaultSeconds); };
  const common = () => ({ content, formatId, seconds, platform, instructions });

  async function plan(withFeedback?: string) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/videos/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...common(), count, feedback: withFeedback ?? '' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível sugerir ideias.');
      setIdeas(j.ideas); setStep(2); setFeedback('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }

  const setItem = (i: number, patch: Partial<Item>) => setItems((a) => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  async function generateOne(i: number, idea: VideoIdea) {
    setItem(i, { status: 'run', error: undefined });
    try {
      const r = await fetch('/api/videos/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...common(), idea, batchId: batch.current }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível gerar este roteiro.');
      setItem(i, { status: 'done', id: j.id, title: j.title });
    } catch (e) { setItem(i, { status: 'err', error: e instanceof Error ? e.message : 'Erro inesperado.' }); }
  }
  /** O primeiro roteiro roda sozinho (grava o conteúdo no cache do prompt); os demais, 3 por vez. */
  async function runQueue(list: { i: number; idea: VideoIdea }[]) {
    setRunning(true);
    const queue = [...list];
    const first = queue.shift();
    if (first) await generateOne(first.i, first.idea);
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => { for (let n = queue.shift(); n; n = queue.shift()) await generateOne(n.i, n.idea); }));
    setRunning(false);
  }
  function start() {
    const good = ideas.filter((x) => x.title.trim());
    batch.current = crypto.randomUUID();
    setItems(good.map((idea) => ({ idea, status: 'wait' })));
    setStep(3);
    runQueue(good.map((idea, i) => ({ i, idea })));
  }
  const retryFailed = () => runQueue(items.map((x, i) => ({ x, i })).filter(({ x }) => x.status === 'err').map(({ x, i }) => ({ i, idea: x.idea })));
  const done = items.filter((x) => x.status === 'done').length, failed = items.filter((x) => x.status === 'err').length;

  const setIdea = (i: number, patch: Partial<VideoIdea>) => setIdeas((a) => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const validIdeas = ideas.filter((x) => x.title.trim()).length;

  return (
    <div className="vd-wiz">
      <ol className="vd-steps" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? '✓' : i + 1}</span>{s}</li>
        ))}
      </ol>

      {!hasKey && <div className="notice warn" style={{ marginBottom: 16 }}>A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
      {remaining <= 0 && <div className="notice err" style={{ marginBottom: 16 }}>O limite diário de roteiros da marca foi atingido. Tente amanhã.</div>}

      {step === 1 && (
        <div className="vd-step1">
          <div className="card-surface form-card vd-content">
            <div className="field">
              <label htmlFor="vc">Conteúdo-fonte</label>
              <textarea id="vc" rows={14} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole aqui um artigo, uma transcrição de vídeo ou podcast, um roteiro longo ou anotações. Quanto mais rico o conteúdo, mais ideias diferentes a IA encontra." />
              <div className="vd-count"><span>{words.toLocaleString('pt-BR')} palavras</span>{words > 0 && <span>· sugerimos ~{suggested} {suggested === 1 ? 'roteiro' : 'roteiros'} para este texto</span>}{over && <span className="vd-err">· passa de {MAX_CONTENT_CHARS.toLocaleString('pt-BR')} caracteres; o excesso será ignorado</span>}</div>
            </div>
            <details className="vd-more">
              <summary>Instruções extras <span className="muted">(opcional)</span></summary>
              <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1500} placeholder="Ex.: Fale com tom de conversa entre amigos. Cite sempre a fonte. Evite termos técnicos." />
            </details>
          </div>

          <div className="vd-config">
            <div className="card-surface form-card">
              <div className="lbl">Formato</div>
              <div className="vd-formats">
                {formats.map((f) => (
                  <button key={f.id} type="button" className={`vd-format${f.id === formatId ? ' on' : ''}`} onClick={() => pickFormat(f)} aria-pressed={f.id === formatId}>
                    <b>{f.name}</b>
                    <span>{f.parts.length} partes · {fmtSecs(f.defaultSeconds)}</span>
                    <PartsBar parts={f.parts.map((p, i) => ({ name: p.name, seconds: allocate(f.parts, f.defaultSeconds)[i] }))} small />
                  </button>
                ))}
              </div>
              {canEditFormats && <Link href="/admin/videos/formatos" className="vd-link">Criar ou editar formatos e instruções por parte →</Link>}
            </div>

            <div className="card-surface form-card">
              <div className="field">
                <div className="lbl">Duração</div>
                <div className="vd-chips">
                  {DURATION_PRESETS.map((d) => <button key={d} type="button" className={`vd-chip${seconds === d ? ' on' : ''}`} onClick={() => setSeconds(d)}>{d}s</button>)}
                  <label className="vd-custom">outra: <input type="number" min={MIN_SECONDS} max={MAX_SECONDS} value={seconds} onChange={(e) => setSeconds(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number(e.target.value) || MIN_SECONDS)))} /> s</label>
                </div>
                <small className="muted">≈ {wordsFor(seconds)} palavras de fala no vídeo todo</small>
              </div>
              <div className="field">
                <div className="lbl">Plataforma</div>
                <div className="vd-segmented" role="radiogroup">
                  {PLATFORMS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={platform === p.id} className={platform === p.id ? 'on' : ''} onClick={() => setPlatform(p.id)}>{p.label}<small>{p.hint}</small></button>)}
                </div>
              </div>
              <div className="field">
                <div className="lbl">Quantos roteiros?</div>
                <div className="vd-stepper">
                  <button type="button" onClick={() => setCount((n) => Math.max(1, n - 1))} aria-label="Menos">−</button>
                  <b>{Math.min(count, maxCount || 1)}</b>
                  <button type="button" onClick={() => setCount((n) => Math.min(maxCount, n + 1))} aria-label="Mais">+</button>
                </div>
                <small className="muted">Cada roteiro usa um ângulo diferente do conteúdo.</small>
              </div>
            </div>

            {format && (
              <div className="card-surface form-card vd-preview">
                <div className="lbl">Como o vídeo vai ser dividido</div>
                <PartsBar parts={format.parts.map((p, i) => ({ name: p.name, seconds: secs[i] }))} />
                <ol>{format.parts.map((p, i) => <li key={p.id}><b>{p.name}</b> <span className="muted">· {fmtSecs(secs[i])}</span></li>)}</ol>
              </div>
            )}
          </div>

          {err && <div className="notice err">{err}</div>}
          <div className="gen-foot vd-foot">
            <span className="muted">Sugerir as ideias custa ≈ {fmtUsd(ESTIMATED_COST_PLAN)}. Os roteiros só são gerados depois da sua aprovação.</span>
            <button type="button" className="btn primary" onClick={() => plan()} disabled={busy || tooShort || !format || !hasKey || remaining <= 0}>
              {busy ? 'Pensando nas ideias…' : <><IconSpark /> Sugerir ideias</>}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="vd-step2">
          <div className="vd-summary">
            <span className="pill">{format?.name}</span><span className="pill">{fmtSecs(seconds)}</span><span className="pill">{PLATFORMS.find((p) => p.id === platform)?.label}</span>
            <button type="button" className="vd-link" onClick={() => setStep(1)}>Alterar</button>
          </div>
          <p className="muted vd-lead">Revise as ideias: edite o título e o ângulo, tire as que não quiser ou acrescente as suas. Cada ideia vira um roteiro.</p>

          <div className="vd-ideas">
            {ideas.map((idea, i) => (
              <div key={i} className="card-surface vd-idea">
                <span className="vd-num">{i + 1}</span>
                <div className="vd-idea-body">
                  <input value={idea.title} onChange={(e) => setIdea(i, { title: e.target.value })} maxLength={140} placeholder="Título / gancho do vídeo" aria-label={`Título da ideia ${i + 1}`} />
                  <textarea rows={2} value={idea.angle} onChange={(e) => setIdea(i, { angle: e.target.value })} maxLength={500} placeholder="Ângulo: o que o vídeo mostra e o que o espectador ganha" aria-label={`Ângulo da ideia ${i + 1}`} />
                  <details className="vd-more">
                    <summary>Pontos do conteúdo que serão usados ({idea.points.length})</summary>
                    <textarea rows={3} value={idea.points.join('\n')} onChange={(e) => setIdea(i, { points: e.target.value.split('\n').filter((l) => l.trim()) })} placeholder="Um ponto por linha" />
                  </details>
                </div>
                <button type="button" className="btn small ghost danger" onClick={() => setIdeas((a) => a.filter((_, k) => k !== i))} aria-label="Remover ideia"><IconTrash /></button>
              </div>
            ))}
            {ideas.length < Math.min(MAX_VIDEO_IDEAS, remaining) && (
              <button type="button" className="vd-add" onClick={() => setIdeas((a) => [...a, { title: '', angle: '', points: [] }])}><IconPlus /> Adicionar uma ideia minha</button>
            )}
          </div>

          <div className="card-surface vd-redo">
            <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Quer outras ideias? Diga o que mudar (ex.: mais polêmicas, focar em quem está começando)" maxLength={600} />
            <button type="button" className="btn" onClick={() => plan(feedback)} disabled={busy}>{busy ? 'Pensando…' : 'Sugerir outras ideias'}</button>
          </div>

          {err && <div className="notice err">{err}</div>}
          <div className="gen-foot vd-foot">
            <button type="button" className="btn ghost" onClick={() => setStep(1)}><IconBack /> Voltar</button>
            <span className="muted">≈ {fmtUsd(validIdeas * ESTIMATED_COST_PER_SCRIPT)} no total</span>
            <button type="button" className="btn primary" onClick={start} disabled={!validIdeas || busy}><IconSpark /> Gerar {validIdeas} {validIdeas === 1 ? 'roteiro' : 'roteiros'}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="vd-step3">
          <div className="card-surface vd-progress">
            <div className="vd-progress-top">
              <b>{running ? 'Escrevendo os roteiros…' : failed ? 'Concluído, com alguns erros' : 'Tudo pronto!'}</b>
              <span className="muted">{done} de {items.length} prontos</span>
            </div>
            <div className="progress"><span style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} /></div>
            {running && <small className="muted">Mantenha esta aba aberta. Os roteiros prontos já ficam salvos.</small>}
          </div>

          <div className="vd-results">
            {items.map((x, i) => (
              <div key={i} className={`card-surface vd-result ${x.status}`}>
                <span className={`vd-state ${x.status}`}>{x.status === 'done' ? '✓' : x.status === 'err' ? '!' : x.status === 'run' ? <i className="vd-spin" /> : i + 1}</span>
                <div className="vd-result-body">
                  <b>{x.title || x.idea.title}</b>
                  <span className="muted">{x.status === 'wait' ? 'Na fila' : x.status === 'run' ? 'Escrevendo…' : x.status === 'done' ? 'Roteiro pronto' : x.error}</span>
                </div>
                {x.status === 'done' && <Link href={`/admin/videos/${x.id}`} className="btn small">Abrir</Link>}
              </div>
            ))}
          </div>

          <div className="gen-foot vd-foot">
            {failed > 0 && !running ? <button type="button" className="btn" onClick={retryFailed}>Tentar de novo os {failed} com erro</button> : <span />}
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => { setStep(1); setItems([]); setIdeas([]); }} disabled={running}>Gerar mais</button>
              <Link href="/admin/videos" className="btn primary" aria-disabled={running}>Ver todos os roteiros</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
