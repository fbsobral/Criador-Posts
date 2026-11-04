'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { ARTICLE_ANGLES, ARTICLE_LENGTHS, ESTIMATED_COST_ARTICLE, ESTIMATED_COST_OUTLINE, MAX_SOURCE_CHARS, type ArticleAngleId, type ArticleLengthId, type OutlineSection } from '@/lib/substack';
import { IconBack, IconBulb, IconDown, IconPen, IconPlus, IconSpark, IconText, IconTrash, IconUp } from '../../../icons';

type IdeaRow = { id: string; pain: string; personaName: string; territory: string; cta: string };
type Kind = 'idea' | 'tema' | 'material';
type Plan = { angle: string; titles: string[]; subtitle: string; hook: string; sections: OutlineSection[] };

const STEPS = ['Ponto de partida', 'Esboço', 'Escrita'];
const KINDS: { id: Kind; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'idea', label: 'De uma ideia', hint: 'Transforma uma ideia de conteúdo em artigo, com a persona e a história dela.', icon: <IconBulb /> },
  { id: 'tema', label: 'De um tema', hint: 'Conte o assunto em uma ou duas frases.', icon: <IconPen /> },
  { id: 'material', label: 'De um material', hint: 'Cole anotações, uma transcrição ou um texto para reescrever com a sua voz.', icon: <IconText /> },
];
const WRITING = [
  'Lendo a ideia com calma…', 'Escolhendo a primeira frase, a que prende…', 'Dando voz à persona…', 'Costurando os intertítulos…', 'Cortando o que não serve à tese…',
  'Pensando em como o texto termina…', 'Afinando o título e o assunto do e-mail…', 'Escrevendo três Notes para divulgar…',
];
const OUTLINING = ['Procurando a tese…', 'Testando títulos…', 'Desenhando o caminho do texto…'];

async function call<T>(url: string, body: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { error: j?.error ?? 'Algo deu errado. Tente de novo.' };
    return { data: j as T };
  } catch { return { error: 'Sem conexão com o servidor. Tente de novo.' }; }
}

export function Studio({ ideas, initialIdeaId, hasKey, remaining }: { ideas: IdeaRow[]; initialIdeaId: string; hasKey: boolean; remaining: number }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<Kind>(initialIdeaId || ideas.length ? 'idea' : 'tema');
  const [ideaId, setIdeaId] = useState(initialIdeaId);
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [angle, setAngle] = useState<ArticleAngleId>('auto');
  const [length, setLength] = useState<ArticleLengthId>('medio');
  const [instructions, setInstructions] = useState('');
  const [review, setReview] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    if (!busy) return;
    started.current = Date.now(); setTick(0); setSecs(0);
    const t = setInterval(() => { setTick((n) => n + 1); setSecs(Math.round((Date.now() - started.current) / 1000)); }, 2600);
    const s = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 1000);
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => { clearInterval(t); clearInterval(s); window.removeEventListener('beforeunload', h); };
  }, [busy]);

  const shown = useMemo(() => { const k = q.trim().toLowerCase(); return k ? ideas.filter((i) => `${i.pain} ${i.personaName} ${i.territory}`.toLowerCase().includes(k)) : ideas; }, [ideas, q]);
  const textOk = kind === 'idea' ? !!ideaId : kind === 'tema' ? text.trim().length >= 8 : text.trim().length >= 80;
  const body = () => ({ kind, ideaId, text, angle, length, instructions });

  async function makePlan() {
    setBusy(true); setErr(''); setStep(2);
    const r = await call<{ plan: Plan }>('/api/substack/plan', body());
    setBusy(false);
    if (r.error || !r.data) { setErr(r.error ?? 'Não foi possível montar o esboço.'); return; }
    setPlan(r.data.plan); setTitle(r.data.plan.titles[0] ?? '');
  }
  async function write(approved: boolean) {
    setBusy(true); setErr(''); setStep(3);
    const r = await call<{ id: string }>('/api/substack/write', { ...body(), plan: approved && plan ? { title, subtitle: plan.subtitle, hook: plan.hook, sections: plan.sections } : null });
    if (r.error || !r.data) { setBusy(false); setErr(r.error ?? 'Não foi possível escrever o artigo.'); return; }
    setDone(true);
    setTimeout(() => router.push(`/admin/substack/${r.data!.id}`), 1100);
  }
  const start = () => (review ? makePlan() : write(false));
  const setSection = (i: number, patch: Partial<OutlineSection>) => setPlan((p) => p && { ...p, sections: p.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const moveSection = (i: number, d: -1 | 1) => setPlan((p) => { if (!p) return p; const j = i + d; if (j < 0 || j >= p.sections.length) return p; const s = [...p.sections]; [s[i], s[j]] = [s[j], s[i]]; return { ...p, sections: s }; });
  const cost = (review ? ESTIMATED_COST_OUTLINE : 0) + ESTIMATED_COST_ARTICLE;

  if (!hasKey) return <div className="card-surface sb-pad"><b>A IA ainda não foi configurada neste servidor.</b><p className="muted">Peça a quem administra para configurar a chave da Anthropic (ANTHROPIC_API_KEY).</p></div>;
  if (remaining <= 0) return <div className="card-surface sb-pad"><b>O limite diário de artigos da marca foi atingido.</b><p className="muted">Volte amanhã ou peça para aumentar o limite.</p></div>;

  return (
    <div className="sb-studio">
      <ol className="sb-steps" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? '✓' : i + 1}</span>{s}</li>
        ))}
      </ol>

      {step === 1 && (
        <div className="sb-panel">
          <h2 className="sb-q">De onde nasce este artigo?</h2>
          <div className="sb-kinds">
            {KINDS.map((k) => (
              <button key={k.id} type="button" className={`sb-kind${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}>
                <i>{k.icon}</i><b>{k.label}</b><small>{k.hint}</small>
              </button>
            ))}
          </div>

          {kind === 'idea' && (
            <div className="sb-ideas">
              {ideas.length === 0 ? <p className="muted">Você ainda não tem ideias disponíveis. Crie algumas em Ideias de conteúdo, ou escreva a partir de um tema.</p> : (
                <>
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas ideias…" aria-label="Buscar nas ideias" />
                  <div className="sb-idea-list">
                    {shown.map((i) => (
                      <button key={i.id} type="button" className={`sb-idea${ideaId === i.id ? ' on' : ''}`} onClick={() => setIdeaId(i.id)} aria-pressed={ideaId === i.id}>
                        <b>{i.pain}</b>
                        <small>{[i.personaName, i.territory].filter(Boolean).join(' · ') || 'Sem persona'}</small>
                      </button>
                    ))}
                    {!shown.length && <p className="muted">Nenhuma ideia com esse termo.</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {kind === 'tema' && <textarea className="sb-ta" rows={4} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: por que o primeiro emprego parece uma porta trancada, e quem pode abri-la" />}
          {kind === 'material' && (
            <>
              <textarea className="sb-ta" rows={9} value={text} maxLength={MAX_SOURCE_CHARS} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui anotações, uma transcrição, um texto antigo…" />
              <small className="muted">{text.trim() ? `${text.trim().split(/\s+/).length} palavras` : 'A IA usa só os fatos deste material.'}</small>
            </>
          )}

          <h3 className="sb-h">Que tipo de texto?</h3>
          <div className="sb-chips">
            {ARTICLE_ANGLES.map((a) => (
              <button key={a.id} type="button" className={`sb-chip${angle === a.id ? ' on' : ''}`} onClick={() => setAngle(a.id)} aria-pressed={angle === a.id} title={a.hint}>{a.label}</button>
            ))}
          </div>
          <small className="muted">{ARTICLE_ANGLES.find((a) => a.id === angle)?.hint}</small>

          <h3 className="sb-h">Quanto tempo de leitura?</h3>
          <div className="sb-chips">
            {ARTICLE_LENGTHS.map((l) => (
              <button key={l.id} type="button" className={`sb-chip${length === l.id ? ' on' : ''}`} onClick={() => setLength(l.id)} aria-pressed={length === l.id}>{l.label} · {l.minutes} min</button>
            ))}
          </div>

          <label className="field sb-extra">Instruções extras (opcional)
            <textarea rows={2} maxLength={1200} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex.: abra com uma cena; cite a Maria só como exemplo; termine pedindo respostas." />
          </label>
          <label className="id-review-opt"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> <span><b>Revisar o esboço antes de escrever</b><small>Escolha o título e ajuste as seções; só depois a IA escreve o texto.</small></span></label>

          <div className="sb-foot">
            <span className="muted">≈ {fmtUsd(cost)} · você edita tudo depois</span>
            <button type="button" className="btn primary" disabled={!textOk} onClick={start}><IconSpark /> {review ? 'Montar o esboço' : 'Escrever o artigo'}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="sb-panel">
          {busy && <Atelier lines={OUTLINING} tick={tick} secs={secs} title="Montando o esboço" />}
          {!busy && err && <ErrorBox err={err} onBack={() => { setStep(1); setErr(''); }} onRetry={makePlan} />}
          {!busy && plan && !err && (
            <>
              <h2 className="sb-q">Escolha o título e ajuste o caminho</h2>
              <div className="sb-titles" role="radiogroup" aria-label="Título">
                {plan.titles.map((t) => (
                  <label key={t} className={`sb-title${title === t ? ' on' : ''}`}><input type="radio" name="title" checked={title === t} onChange={() => setTitle(t)} /><span>{t}</span></label>
                ))}
                <input className="sb-own" value={plan.titles.includes(title) ? '' : title} onChange={(e) => setTitle(e.target.value)} placeholder="…ou escreva o seu título" maxLength={120} />
              </div>
              <label className="field">Subtítulo<input value={plan.subtitle} maxLength={200} onChange={(e) => setPlan({ ...plan, subtitle: e.target.value })} /></label>
              <label className="field">Como o texto abre<textarea rows={2} value={plan.hook} maxLength={300} onChange={(e) => setPlan({ ...plan, hook: e.target.value })} /></label>
              <h3 className="sb-h">Seções</h3>
              <div className="sb-outline">
                {plan.sections.map((s, i) => (
                  <div key={i} className="sb-sec">
                    <span className="sb-n">{i + 1}</span>
                    <div>
                      <input value={s.heading} maxLength={120} onChange={(e) => setSection(i, { heading: e.target.value })} aria-label={`Intertítulo ${i + 1}`} />
                      <textarea rows={2} value={s.point} maxLength={240} onChange={(e) => setSection(i, { point: e.target.value })} aria-label={`O que a seção ${i + 1} conta`} />
                    </div>
                    <div className="sb-sec-btns">
                      <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="Subir"><IconUp /></button>
                      <button type="button" className="btn small ghost" disabled={i === plan.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="Descer"><IconDown /></button>
                      <button type="button" className="btn small ghost danger" disabled={plan.sections.length <= 2} onClick={() => setPlan({ ...plan, sections: plan.sections.filter((_, k) => k !== i) })} aria-label="Remover"><IconTrash /></button>
                    </div>
                  </div>
                ))}
                {plan.sections.length < 8 && <button type="button" className="btn small" onClick={() => setPlan({ ...plan, sections: [...plan.sections, { heading: '', point: '' }] })}><IconPlus /> Adicionar seção</button>}
              </div>
              <div className="sb-foot">
                <button type="button" className="btn" onClick={() => { setStep(1); setPlan(null); }}><IconBack /> Voltar</button>
                <button type="button" className="btn" onClick={makePlan}>Refazer o esboço</button>
                <button type="button" className="btn primary" disabled={!title.trim() || plan.sections.some((s) => !s.heading.trim())} onClick={() => write(true)}><IconSpark /> Aprovar e escrever</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="sb-panel">
          {done ? (
            <div className="sb-done"><div className="sb-burst" aria-hidden>✦</div><h2>Rascunho pronto!</h2><p className="muted">Abrindo o seu artigo…</p></div>
          ) : busy ? <Atelier lines={WRITING} tick={tick} secs={secs} title="Escrevendo o seu artigo" />
            : <ErrorBox err={err} onBack={() => { setStep(plan ? 2 : 1); setErr(''); }} onRetry={() => write(!!plan)} />}
        </div>
      )}
    </div>
  );
}

function Atelier({ lines, tick, secs, title }: { lines: string[]; tick: number; secs: number; title: string }) {
  return (
    <div className="sb-atelier" role="status" aria-live="polite">
      <div className="sb-paper" aria-hidden><i /><i /><i /><i /><i /><b>|</b></div>
      <h2>{title}</h2>
      <p key={tick} className="sb-line">{lines[tick % lines.length]}</p>
      <small className="muted">{secs}s · pode levar até um minuto. Não feche esta página.</small>
    </div>
  );
}

function ErrorBox({ err, onBack, onRetry }: { err: string; onBack: () => void; onRetry: () => void }) {
  return (
    <div className="sb-err"><b>Não deu certo desta vez.</b><p>{err}</p><div className="row-actions"><button type="button" className="btn" onClick={onBack}><IconBack /> Voltar</button><button type="button" className="btn primary" onClick={onRetry}>Tentar de novo</button></div></div>
  );
}
