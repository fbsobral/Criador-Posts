'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { actionErrorMessage } from '@/lib/action-error';
import { fmtUsd } from '@/lib/ai/constants';
import { IDEA_INSTRUCTIONS, ideaAngle, ideaBrief, ideaPoints, ideaTitle, type Idea } from '@/lib/idea';
import { createPostFromIdea } from '@/lib/idea-actions';
import { DURATION_PRESETS, ESTIMATED_COST_PER_SCRIPT, MIN_SECONDS, fmtSecs, type Platform, type VideoPart } from '@/lib/video';
import { CAROUSEL_ANGLES, type CarouselAngleId } from '@/lib/ai/carousel-rules';
import { IconSpark } from '../../icons';

export type VideoFormatLite = { id: string; name: string; description: string; defaultSeconds: number; parts: VideoPart[] };
export type PostTemplateLite = { id: string; name: string; description: string; editor: string };

/** Transforma uma ideia em roteiro de vídeo ou em post de imagem, já com a história da ideia como base. */
export function IdeaConvertModal({ idea, mode, formats, templates, hasKey, onClose }: {
  idea: Idea; mode: 'script' | 'post'; formats: VideoFormatLite[]; templates: PostTemplateLite[]; hasKey: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formatId, setFormatId] = useState(formats[0]?.id ?? '');
  const [seconds, setSeconds] = useState(Math.max(MIN_SECONDS, formats[0]?.defaultSeconds ?? 45));
  const platform: Platform = 'all'; // sem escolha de plataforma
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [slides, setSlides] = useState(0); // 0 = a IA decide pelo conteúdo
  const [angle, setAngle] = useState<CarouselAngleId>('auto');
  const [review, setReview] = useState(false); // aprovar o roteiro dos slides antes da escrita
  const [plan, setPlan] = useState<{ angle: string; promise: string; slides: { role: string; message: string }[]; covers: string[] } | null>(null);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isScript = mode === 'script';
  const ready = isScript ? !!formatId : !!templateId;
  const tpl = templates.find((t) => t.id === templateId);
  const isCarousel = tpl?.editor === 'carrossel';

  async function makeScript() {
    setBusy(true); setErr('');
    try {
      const content = ideaBrief(idea, idea.personaName, idea.territory);
      const r = await fetch('/api/videos/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, ideaId: idea.id, personaIds: idea.personaIds, formatId, seconds, platform, instructions: [IDEA_INSTRUCTIONS, extra].filter(Boolean).join('\n'), idea: { title: ideaTitle(idea.pain), angle: ideaAngle(idea), points: ideaPoints(idea) } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível gerar o roteiro.');
      router.push(`/admin/videos/${j.id}`);
    } catch (e) { setErr(actionErrorMessage(e)); setBusy(false); }
  }
  const write = (approved: typeof plan) => start(async () => {
    setErr('');
    try {
      const r = await createPostFromIdea(idea.id, templateId, { slides, angle: approved?.angle || (angle === 'auto' ? '' : angle), plan: approved ? { angle: approved.angle, promise: approved.promise, slides: approved.slides } : null, extra, withImages: false }); // sucesso redireciona para o lote
      if (r?.error) setErr(r.error);
    } catch (e) {
      if (e instanceof Error && 'digest' in e && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw e; // é o redirecionamento de sucesso
      setErr(actionErrorMessage(e));
    }
  });
  async function makePlan() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/posts/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ideaId: idea.id, angle, slides, instructions: extra }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível planejar o carrossel.');
      setPlan(j.plan);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setBusy(false); }
  }
  const makePost = () => (isCarousel && review ? makePlan() : write(null));
  const setMsg = (i: number, message: string) => setPlan((p) => (p ? { ...p, slides: p.slides.map((x, k) => (k === i ? { ...x, message } : x)) } : p));
  const moveSlide = (i: number, d: number) => setPlan((p) => { if (!p) return p; const j = i + d; if (j < 1 || j >= p.slides.length) return p; const a = [...p.slides]; [a[i], a[j]] = [a[j], a[i]]; return { ...p, slides: a }; });
  const removeSlide = (i: number) => setPlan((p) => (p && p.slides.length > 3 && i > 0 ? { ...p, slides: p.slides.filter((_, k) => k !== i) } : p));
  const go = isScript ? makeScript : makePost;
  const working = busy || pending;

  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget && !working) onClose(); }}>
      <div className="pe-modal" role="dialog" aria-modal="true" aria-label={isScript ? 'Criar roteiro a partir da ideia' : 'Criar post a partir da ideia'}>
        <header><h2>{isScript ? 'Criar roteiro de vídeo' : 'Criar post de imagem'}</h2><button type="button" className="btn small ghost" onClick={onClose} disabled={working} aria-label="Fechar">✕</button></header>
        <div className="pe-modal-body">
          <div className="id-from"><span>Ideia</span><p>{ideaTitle(idea.pain)}</p><small>{idea.personaName}{idea.territory ? ` · ${idea.territory}` : ''}</small></div>

          {isScript ? (
            <>
              <div className="field">
                <label>Formato do vídeo</label>
                <div className="tr-choices">
                  {formats.map((f) => <button key={f.id} type="button" className={`tr-choice${f.id === formatId ? ' on' : ''}`} aria-pressed={f.id === formatId} onClick={() => { setFormatId(f.id); setSeconds(Math.max(MIN_SECONDS, f.defaultSeconds)); }}><b>{f.name}</b><small>{f.description || `${f.parts.length} partes`}</small></button>)}
                </div>
              </div>
              <div className="field">
                <label>Duração</label>
                <div className="vd-chips">{DURATION_PRESETS.map((s) => <button key={s} type="button" className={`vd-chip${seconds === s ? ' on' : ''}`} onClick={() => setSeconds(s)}>{fmtSecs(s)}</button>)}</div>
              </div>
            </>
          ) : (
            plan ? (
              <>
                <div className="notice info"><b>Roteiro dos slides.</b> Ajuste a mensagem de cada slide, escolha a capa e aprove: a IA escreve seguindo esta ordem.{plan.promise && <> Promessa: <i>{plan.promise}</i></>}</div>
                {plan.covers.length > 0 && (
                  <div className="field">
                    <label>Capa (clique para usar)</label>
                    <div className="id-covers">
                      {Array.from(new Set([plan.slides[0]?.message, ...plan.covers].filter(Boolean) as string[])).map((c, i) => (
                        <button key={i} type="button" className={`id-cover${plan.slides[0]?.message === c ? ' on' : ''}`} onClick={() => setMsg(0, c)}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="id-plan">
                  {plan.slides.map((x, i) => (
                    <div key={i} className="id-plan-row">
                      <span className="id-plan-n">{i + 1}</span>
                      <div className="id-plan-body"><small>{x.role}</small><textarea rows={2} value={x.message} maxLength={220} onChange={(e) => setMsg(i, e.target.value)} aria-label={`Mensagem do slide ${i + 1}`} /></div>
                      <span className="id-plan-tools">
                        <button type="button" className="btn small ghost" onClick={() => moveSlide(i, -1)} disabled={i < 2} aria-label="Subir slide" title="Subir">↑</button>
                        <button type="button" className="btn small ghost" onClick={() => moveSlide(i, 1)} disabled={i === 0 || i === plan.slides.length - 1} aria-label="Descer slide" title="Descer">↓</button>
                        <button type="button" className="btn small ghost danger" onClick={() => removeSlide(i)} disabled={i === 0 || plan.slides.length <= 3} aria-label="Remover slide" title="Remover">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
            <>
              <div className="field">
                <label>Formato do post</label>
                <div className="tr-choices">
                  {templates.map((t) => <button key={t.id} type="button" className={`tr-choice${t.id === templateId ? ' on' : ''}`} aria-pressed={t.id === templateId} onClick={() => setTemplateId(t.id)}><b>{t.name}</b><small>{t.description || t.editor}</small></button>)}
                </div>
              </div>
              {isCarousel && (
                <div className="field">
                  <label>Ângulo do carrossel</label>
                  <div className="vd-chips" role="radiogroup" aria-label="Ângulo do carrossel">
                    {CAROUSEL_ANGLES.map((a) => <button key={a.id} type="button" role="radio" aria-checked={angle === a.id} className={`vd-chip${angle === a.id ? ' on' : ''}`} onClick={() => setAngle(a.id)} title={a.hint}>{a.label}</button>)}
                  </div>
                  <small className="muted">{CAROUSEL_ANGLES.find((a) => a.id === angle)?.hint}. É o fio que organiza os slides.</small>
                </div>
              )}
              <div className="field">
                <label>Slides</label>
                <div className="vd-chips">{[0, 5, 6, 7, 8, 9, 10].map((n) => <button key={n} type="button" className={`vd-chip${slides === n ? ' on' : ''}`} onClick={() => setSlides(n)}>{n === 0 ? 'A IA decide' : n}</button>)}</div>
                {slides === 0 && <small className="muted">Recomendado: de 6 a 9 slides, conforme o conteúdo da ideia.</small>}
              </div>
              {isCarousel && (
                <label className="id-review-opt"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /><span><b>Revisar o roteiro dos slides antes de escrever</b><small>A IA mostra a mensagem de cada slide e 3 alternativas de capa; você ajusta e aprova.</small></span></label>
              )}
            </>
            )
          )}
          {!plan && <details className="vd-more">
            <summary>Instruções extras <span className="muted">(opcional)</span></summary>
            <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={1200} placeholder="Ex.: tom mais emocional, abrir com uma pergunta." />
          </details>}
          <div className="notice info">A IA usa toda a história da ideia (dor, impacto, causa, guia, argumentos, ganho, desejo e CTA) e a ideia passa a constar como <b>já usada</b>. {isScript ? 'O roteiro fica pronto para revisar e editar.' : 'O post chega como rascunho no editor.'}</div>
          {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
          {busy && <div className="notice info" role="status">{isScript ? 'A IA está escrevendo o roteiro. Leva cerca de 20 a 40 segundos' : 'A IA está planejando os slides. Leva cerca de 10 a 25 segundos'}; mantenha esta janela aberta.</div>}
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          <span className="muted">≈ {fmtUsd(isScript ? ESTIMATED_COST_PER_SCRIPT : review && isCarousel ? 0.05 : 0.035)}</span>
          {plan ? (
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => { setPlan(null); setErr(''); }} disabled={working}>← Voltar</button>
              <button type="button" className="btn" onClick={makePlan} disabled={working}>{busy ? 'Planejando…' : 'Planejar de novo'}</button>
              <button type="button" className="btn primary" onClick={() => write(plan)} disabled={working || !hasKey || plan.slides.some((x) => !x.message.trim())}>{pending ? 'Criando…' : <><IconSpark /> Aprovar e escrever</>}</button>
            </div>
          ) : (
            <button type="button" className="btn primary" onClick={go} disabled={working || !hasKey || !ready}>{working ? (isScript ? 'Gerando…' : isCarousel && review ? 'Planejando…' : 'Criando…') : <><IconSpark /> {isScript ? 'Gerar roteiro' : isCarousel && review ? 'Planejar slides' : 'Gerar post'}</>}</button>
          )}
        </footer>
      </div>
    </div>
  );
}
