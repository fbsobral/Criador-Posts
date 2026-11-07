'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { ARTICLE_ANGLES, ARTICLE_LENGTHS, ESTIMATED_COST_ARTICLE, ESTIMATED_COST_OUTLINE, MAX_SOURCE_CHARS, type ArticleAngleId, type ArticleLengthId, type OutlineSection } from '@/lib/substack';
import Link from 'next/link';
import { IconBack, IconBulb, IconDown, IconPen, IconPlus, IconSpark, IconText, IconTrash, IconUp } from '../../../icons';

type IdeaRow = { id: string; pain: string; personaName: string; territory: string; cta: string };
type Kind = 'idea' | 'tema' | 'material';
type Plan = { angle: string; titles: string[]; subtitle: string; hook: string; sections: OutlineSection[] };

const STEPS = ['Origem e formato', 'Esboço', 'Artigo'];
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

type Scope = 'all' | 'top' | number;
const REFINE_CHIPS: Record<'all' | 'top' | 'sec', string[]> = {
  all: ['Tese mais clara', 'Menos seções', 'Abrir com uma cena', 'Fechar levando ao convite'],
  top: ['Título mais forte', 'Abrir com uma cena', 'Subtítulo mais claro'],
  sec: ['Mais concreta', 'Intertítulo mais forte', 'Outro ângulo'],
};

/** "Melhorar com IA" de uma parte do esboço: chips de pedido rápido, pedido livre e o botão. */
function RefineBox({ kind, placeholder, busy, onRun, onClose }: { kind: 'all' | 'top' | 'sec'; placeholder: string; busy: boolean; onRun: (fb: string) => void; onClose: () => void }) {
  const [fb, setFb] = useState('');
  return (
    <div className="sb-refine">
      <div className="sb-chips sm">{REFINE_CHIPS[kind].map((c) => <button key={c} type="button" className="sb-chip" disabled={busy} onClick={() => onRun(c)}>{c}</button>)}</div>
      <div className="sb-refine-row">
        <input value={fb} onChange={(e) => setFb(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); onRun(fb); } }} placeholder={placeholder} maxLength={600} disabled={busy} aria-label="Pedido para a IA" />
        <button type="button" className="btn small primary" disabled={busy} onClick={() => onRun(fb)}><IconSpark /> {busy ? 'Melhorando…' : 'Melhorar'}</button>
        <button type="button" className="btn small ghost" disabled={busy} onClick={onClose}>Cancelar</button>
      </div>
      <small className="muted">Sem pedido, a IA só deixa mais forte e específico. O resto do esboço não muda{kind === 'all' ? ', e o que você editou é mantido' : ''}.</small>
    </div>
  );
}

export function Studio({ ideas, initialIdeaId, hasKey, remaining }: { ideas: IdeaRow[]; initialIdeaId: string; hasKey: boolean; remaining: number }) {
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
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState<Scope | null>(null);
  const [rbusy, setRbusy] = useState(false);
  const [undo, setUndo] = useState<{ plan: Plan; title: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const started = useRef(0);

  useEffect(() => {
    if (!busy) return;
    started.current = Date.now(); setTick(0); setSecs(0);
    const t = setInterval(() => setTick((n) => n + 1), 2600);
    const s = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 1000);
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => { clearInterval(t); clearInterval(s); window.removeEventListener('beforeunload', h); };
  }, [busy]);

  const shown = useMemo(() => { const k = q.trim().toLowerCase(); return k ? ideas.filter((i) => `${i.pain} ${i.personaName} ${i.territory}`.toLowerCase().includes(k)) : ideas; }, [ideas, q]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const textOk = kind === 'idea' ? !!ideaId : kind === 'tema' ? text.trim().length >= 8 : text.trim().length >= 80;
  const body = (extra = '') => ({ kind, ideaId, text, angle, length, instructions: [instructions, extra].filter(Boolean).join('\n') });
  const blocked = !hasKey || remaining <= 0;

  async function makePlan(fb = '') {
    setBusy(true); setErr(''); setStep(2);
    const r = await call<{ plan: Plan }>('/api/substack/plan', body(fb.trim() ? `AJUSTE PEDIDO PELO USUÁRIO AO ESBOÇO: ${fb.trim()}` : ''));
    setBusy(false);
    if (r.error || !r.data) { setErr(r.error ?? 'Não foi possível montar o esboço.'); return; }
    setPlan(r.data.plan); setTitle(r.data.plan.titles[0] ?? ''); setFeedback(''); setUndo(null); setRefining(null);
  }
  async function write(approved: boolean) {
    setBusy(true); setErr(''); setStep(3); setResult(null);
    const r = await call<{ id: string }>('/api/substack/write', { ...body(), plan: approved && plan ? { title, subtitle: plan.subtitle, hook: plan.hook, sections: plan.sections } : null });
    setBusy(false);
    if (r.error || !r.data) { setErr(r.error ?? 'Não foi possível escrever o artigo.'); return; }
    setResult({ id: r.data.id });
  }
  /** Melhora o esboço que está na tela (com as edições) no escopo pedido; guarda a versão anterior para desfazer. */
  async function refine(scope: Scope, fb: string) {
    if (!plan) return;
    setRbusy(true); setErr('');
    const r = await call<{ outline: { title: string; titles: string[]; subtitle: string; hook: string; sections: OutlineSection[] }; note: string }>('/api/substack/plan/refine', { ...body(), outline: { title, titles: plan.titles, subtitle: plan.subtitle, hook: plan.hook, sections: plan.sections }, scope, feedback: fb.trim() });
    setRbusy(false);
    if (r.error || !r.data) { setErr(r.error ?? 'Não foi possível melhorar o esboço.'); return; }
    const o = r.data.outline;
    setUndo({ plan, title, note: r.data.note || 'Esboço melhorado.' });
    setPlan({ ...plan, titles: o.titles.length ? o.titles : plan.titles, subtitle: o.subtitle, hook: o.hook, sections: o.sections });
    setTitle(o.title || title);
    setRefining(null);
  }
  const aiBtn = (scope: Scope, label = 'Melhorar com IA') => refining === scope ? null : <button type="button" className="sb-ai-btn" disabled={rbusy || refining !== null} onClick={() => { setRefining(scope); setErr(''); }}><IconSpark /> {label}</button>;
  const start = () => (review ? makePlan() : write(false));
  const setSection = (i: number, patch: Partial<OutlineSection>) => setPlan((p) => p && { ...p, sections: p.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const moveSection = (i: number, d: -1 | 1) => setPlan((p) => { if (!p) return p; const j = i + d; if (j < 0 || j >= p.sections.length) return p; const s = [...p.sections]; [s[i], s[j]] = [s[j], s[i]]; return { ...p, sections: s }; });
  const cost = (review ? ESTIMATED_COST_OUTLINE : 0) + ESTIMATED_COST_ARTICLE;
  const lengthInfo = ARTICLE_LENGTHS.find((l) => l.id === length)!;

  return (
    <div className="vd-wiz">
      <ol className="vd-steps" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}><span>{step > i + 1 ? '✓' : i + 1}</span>{s}</li>
        ))}
      </ol>

      {!hasKey && <div className="notice warn" style={{ marginBottom: 16 }}>A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
      {remaining <= 0 && <div className="notice err" style={{ marginBottom: 16 }}>O limite diário de artigos da marca foi atingido. Tente amanhã.</div>}

      {step === 1 && (
        <div className="vd-step1">
          <div className="card-surface form-card vd-content">
            <div className="field">
              <div className="lbl">De onde nasce o artigo?</div>
              <div className="vd-formats sb-kinds3">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" className={`vd-format${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}>
                    <b>{k.label}</b><span>{k.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {kind === 'idea' && (
              <div className="field">
                {ideas.length === 0 ? <p className="muted">Você ainda não tem ideias disponíveis. Crie algumas em Ideias de conteúdo ou escreva a partir de um tema.</p> : (
                  <>
                    <label className="lbl" htmlFor="sbq">Ideia de conteúdo</label>
                    <input id="sbq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas ideias…" />
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
            {kind === 'tema' && (
              <div className="field">
                <label htmlFor="sbt">Tema do artigo</label>
                <textarea id="sbt" rows={4} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: por que o primeiro emprego parece uma porta trancada, e quem pode abri-la" />
              </div>
            )}
            {kind === 'material' && (
              <div className="field">
                <label htmlFor="sbm">Material-fonte</label>
                <textarea id="sbm" rows={12} value={text} maxLength={MAX_SOURCE_CHARS} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui anotações, uma transcrição, um texto antigo… A IA usa só os fatos deste material." />
                <div className="vd-count"><span>{words.toLocaleString('pt-BR')} palavras</span></div>
              </div>
            )}
            <details className="vd-more">
              <summary>Tipo de texto <span className="muted">({angle === 'auto' ? 'a IA escolhe' : ARTICLE_ANGLES.find((a) => a.id === angle)?.label.toLowerCase()})</span></summary>
              <div className="vd-chips">
                {ARTICLE_ANGLES.map((a) => <button key={a.id} type="button" className={`vd-chip${angle === a.id ? ' on' : ''}`} onClick={() => setAngle(a.id)} aria-pressed={angle === a.id} title={a.hint}>{a.label}</button>)}
              </div>
              <small className="muted">{ARTICLE_ANGLES.find((a) => a.id === angle)?.hint} Na dúvida, deixe a IA escolher.</small>
            </details>
            <details className="vd-more">
              <summary>Instruções extras <span className="muted">(opcional)</span></summary>
              <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1200} placeholder="Ex.: abra com uma cena; cite a Maria só como exemplo; termine pedindo respostas." />
            </details>
          </div>

          <div className="vd-config">
            <div className="card-surface form-card">
              <div className="field">
                <div className="lbl">Tamanho</div>
                <div className="vd-chips">
                  {ARTICLE_LENGTHS.map((l) => <button key={l.id} type="button" className={`vd-chip${length === l.id ? ' on' : ''}`} onClick={() => setLength(l.id)} aria-pressed={length === l.id}>{l.label} · {l.minutes} min</button>)}
                </div>
                <small className="muted">≈ {lengthInfo.words.toLocaleString('pt-BR')} palavras no artigo todo</small>
              </div>
            </div>
            <div className="card-surface form-card">
              <label className="id-review-opt"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> <span><b>Revisar o esboço antes de escrever</b><small>Escolha o título e ajuste as seções; só depois a IA escreve o texto.</small></span></label>
            </div>
          </div>

          {err && <div className="notice err">{err}</div>}
          <div className="gen-foot vd-foot">
            <span className="muted">{review ? 'Montar o esboço' : 'Escrever o artigo'} custa ≈ {fmtUsd(cost)}. Você edita tudo depois.</span>
            <button type="button" className="btn primary" disabled={!textOk || blocked} onClick={start}><IconSpark /> {review ? 'Montar o esboço' : 'Escrever o artigo'}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="vd-step2">
          <div className="vd-summary">
            <span className="pill">{KINDS.find((k) => k.id === kind)?.label}</span><span className="pill">{ARTICLE_ANGLES.find((a) => a.id === angle)?.label}</span><span className="pill">{lengthInfo.minutes} min</span>
            <button type="button" className="vd-link" onClick={() => { setStep(1); setPlan(null); setErr(''); }} disabled={busy}>Alterar</button>
          </div>
          {busy && <div className="card-surface vd-progress"><Atelier lines={OUTLINING} tick={tick} secs={secs} title="Montando o esboço…" /></div>}
          {!busy && err && <><div className="notice err">{err}</div><div className="gen-foot vd-foot"><button type="button" className="btn ghost" onClick={() => { setStep(1); setErr(''); }}><IconBack /> Voltar</button><button type="button" className="btn primary" onClick={() => makePlan()}>Tentar de novo</button></div></>}
          {!busy && plan && !err && (
            <>
              <p className="muted vd-lead">Revise o esboço: escolha o título, edite o subtítulo e as seções, tire as que não quiser ou acrescente as suas. Cada parte tem um <b>Melhorar com IA</b>. Cada seção vira um trecho do artigo.</p>
              {undo && !rbusy && <div className="notice sb-undo"><span>✓ {undo.note}</span><button type="button" className="vd-link" onClick={() => { setPlan(undo.plan); setTitle(undo.title); setUndo(null); }}>Desfazer</button></div>}
              {err && <div className="notice err">{err}</div>}
              <div className="card-surface form-card sb-esb">
                <div className="field">
                  <div className="lbl">Título</div>
                  <div className="vd-formats sb-titles1">
                    {plan.titles.map((t) => <button key={t} type="button" className={`vd-format${title === t ? ' on' : ''}`} onClick={() => setTitle(t)} aria-pressed={title === t}><b className="sb-serif">{t}</b></button>)}
                  </div>
                  <input value={plan.titles.includes(title) ? '' : title} onChange={(e) => setTitle(e.target.value)} placeholder="…ou escreva o seu título" maxLength={120} />
                </div>
                <label className="field">Subtítulo<input value={plan.subtitle} maxLength={200} onChange={(e) => setPlan({ ...plan, subtitle: e.target.value })} /></label>
                <label className="field">Como o texto abre<textarea rows={2} value={plan.hook} maxLength={300} onChange={(e) => setPlan({ ...plan, hook: e.target.value })} /></label>
                <div className="sb-ai-row">{aiBtn('top', 'Melhorar título, subtítulo e abertura com IA')}</div>
                {refining === 'top' && <RefineBox kind="top" placeholder="O que melhorar? (ex.: título com a contradição, abrir com a cena do currículo)" busy={rbusy} onRun={(fb) => refine('top', fb)} onClose={() => setRefining(null)} />}
              </div>

              <div className="vd-ideas">
                {plan.sections.map((s, i) => (
                  <div key={i} className="card-surface vd-idea">
                    <span className="vd-num">{i + 1}</span>
                    <div className="vd-idea-body">
                      <input value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} maxLength={120} placeholder="Intertítulo da seção" aria-label={`Intertítulo ${i + 1}`} />
                      <textarea rows={2} value={s.point} onChange={(e) => setSection(i, { point: e.target.value })} maxLength={240} placeholder="O que esta seção conta ou prova" aria-label={`O que a seção ${i + 1} conta`} />
                      {aiBtn(i)}
                      {refining === i && <RefineBox kind="sec" placeholder="O que melhorar nesta seção? (ex.: mostrar o lado da empresa)" busy={rbusy} onRun={(fb) => refine(i, fb)} onClose={() => setRefining(null)} />}
                    </div>
                    <div className="sb-sec-btns">
                      <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="Subir"><IconUp /></button>
                      <button type="button" className="btn small ghost" disabled={i === plan.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="Descer"><IconDown /></button>
                      <button type="button" className="btn small ghost danger" disabled={plan.sections.length <= 2} onClick={() => setPlan({ ...plan, sections: plan.sections.filter((_, k) => k !== i) })} aria-label="Remover seção"><IconTrash /></button>
                    </div>
                  </div>
                ))}
                {plan.sections.length < 8 && <button type="button" className="vd-add" onClick={() => setPlan({ ...plan, sections: [...plan.sections, { heading: '', point: '' }] })}><IconPlus /> Adicionar uma seção minha</button>}
              </div>

              <div className="card-surface vd-redo">
                <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Quer outro caminho? Diga o que mudar (ex.: abrir com uma cena, falar mais das empresas)" maxLength={600} />
                <button type="button" className="btn" onClick={() => makePlan(feedback)} disabled={busy || rbusy}>Sugerir outro esboço</button>
              </div>
              <div className="sb-ai-row sb-ai-all">
                {aiBtn('all', 'Melhorar o esboço inteiro com IA')}
                {refining === 'all' && <div className="card-surface sb-refine-card"><RefineBox kind="all" placeholder="O que melhorar no esboço todo? (ex.: falar mais das empresas, menos seções)" busy={rbusy} onRun={(fb) => refine('all', fb)} onClose={() => setRefining(null)} /></div>}
              </div>

              <div className="gen-foot vd-foot">
                <button type="button" className="btn ghost" onClick={() => { setStep(1); setPlan(null); }}><IconBack /> Voltar</button>
                <span className="muted">≈ {fmtUsd(ESTIMATED_COST_ARTICLE)}</span>
                <button type="button" className="btn primary" disabled={rbusy || !title.trim() || plan.sections.some((s) => !s.heading.trim())} onClick={() => write(true)}><IconSpark /> Aprovar e escrever</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="vd-step3">
          <div className="card-surface vd-progress">
            {busy ? <Atelier lines={WRITING} tick={tick} secs={secs} title="Escrevendo o artigo…" /> : (
              <div className="vd-progress-top"><b>{result ? 'Tudo pronto!' : 'Não deu certo desta vez'}</b><span className="muted">{result ? '1 de 1 pronto' : '0 de 1 pronto'}</span></div>
            )}
            <div className="progress"><span style={{ width: result ? '100%' : busy ? `${Math.min(92, 8 + tick * 11)}%` : '0%' }} /></div>
            {busy && <small className="muted">Mantenha esta aba aberta. Leva cerca de um minuto.</small>}
          </div>

          <div className="vd-results">
            <div className={`card-surface vd-result ${result ? 'done' : busy ? 'run' : 'err'}`}>
              <span className={`vd-state ${result ? 'done' : busy ? 'run' : 'err'}`}>{result ? '✓' : busy ? <i className="vd-spin" /> : '!'}</span>
              <div className="vd-result-body">
                <b>{title || 'Artigo para o Substack'}</b>
                <span className="muted">{result ? 'Rascunho pronto' : busy ? 'Escrevendo…' : err}</span>
              </div>
              {result && <Link href={`/admin/substack/${result.id}`} className="btn small primary">Abrir</Link>}
            </div>
          </div>

          <div className="gen-foot vd-foot">
            {!busy && !result ? <button type="button" className="btn" onClick={() => write(!!plan)}>Tentar de novo</button> : <span />}
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => { setStep(1); setPlan(null); setResult(null); setErr(''); }} disabled={busy}>Escrever outro</button>
              <Link href="/admin/substack" className="btn primary" aria-disabled={busy}>Ver todos os artigos</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Atelier({ lines, tick, secs, title }: { lines: string[]; tick: number; secs: number; title: string }) {
  return (
    <div className="sb-atelier" role="status" aria-live="polite">
      <div className="sb-paper" aria-hidden><i /><i /><i /><i /><i /><b>|</b></div>
      <div className="vd-progress-top"><b>{title}</b><span className="muted">{secs}s</span></div>
      <p key={tick} className="sb-line">{lines[tick % lines.length]}</p>
    </div>
  );
}
