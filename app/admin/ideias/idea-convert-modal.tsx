'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtUsd } from '@/lib/ai/constants';
import { IDEA_INSTRUCTIONS, ideaBrief, ideaPoints, ideaTitle, type Idea } from '@/lib/idea';
import { createPostFromIdea, setIdeaStatus } from '@/lib/idea-actions';
import { DURATION_PRESETS, ESTIMATED_COST_PER_SCRIPT, PLATFORMS, fmtSecs, type Platform, type VideoPart } from '@/lib/video';
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
  const [seconds, setSeconds] = useState(formats[0]?.defaultSeconds ?? 45);
  const [platform, setPlatform] = useState<Platform>('reels');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [slides, setSlides] = useState(7);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isScript = mode === 'script';
  const ready = isScript ? !!formatId : !!templateId;

  async function makeScript() {
    setBusy(true); setErr('');
    try {
      const content = ideaBrief(idea, idea.personaName, idea.territory);
      const r = await fetch('/api/videos/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, formatId, seconds, platform, instructions: [IDEA_INSTRUCTIONS, extra].filter(Boolean).join('\n'), idea: { title: ideaTitle(idea.pain), angle: idea.guide || idea.cause, points: ideaPoints(idea) } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível gerar o roteiro.');
      await setIdeaStatus(idea.id, 'used');
      router.push(`/admin/videos/${j.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro inesperado.'); setBusy(false); }
  }
  const makePost = () => start(async () => {
    setErr('');
    const r = await createPostFromIdea(idea.id, templateId, slides, false); // sucesso redireciona para o lote
    if (r?.error) setErr(r.error);
  });
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
                  {formats.map((f) => <button key={f.id} type="button" className={`tr-choice${f.id === formatId ? ' on' : ''}`} aria-pressed={f.id === formatId} onClick={() => { setFormatId(f.id); setSeconds(f.defaultSeconds); }}><b>{f.name}</b><small>{f.description || `${f.parts.length} partes`}</small></button>)}
                </div>
              </div>
              <div className="field">
                <label>Duração</label>
                <div className="vd-chips">{DURATION_PRESETS.map((s) => <button key={s} type="button" className={`vd-chip${seconds === s ? ' on' : ''}`} onClick={() => setSeconds(s)}>{fmtSecs(s)}</button>)}</div>
              </div>
              <div className="field">
                <label>Plataforma</label>
                <div className="vd-chips">{PLATFORMS.map((p) => <button key={p.id} type="button" className={`vd-chip${platform === p.id ? ' on' : ''}`} onClick={() => setPlatform(p.id)}>{p.label}</button>)}</div>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Formato do post</label>
                <div className="tr-choices">
                  {templates.map((t) => <button key={t.id} type="button" className={`tr-choice${t.id === templateId ? ' on' : ''}`} aria-pressed={t.id === templateId} onClick={() => setTemplateId(t.id)}><b>{t.name}</b><small>{t.description || 'Formato de post'}</small></button>)}
                </div>
              </div>
              <div className="field">
                <label>Slides</label>
                <div className="vd-chips">{[5, 6, 7, 8, 9, 10].map((n) => <button key={n} type="button" className={`vd-chip${slides === n ? ' on' : ''}`} onClick={() => setSlides(n)}>{n}</button>)}</div>
              </div>
            </>
          )}
          <details className="vd-more">
            <summary>Instruções extras <span className="muted">(opcional)</span></summary>
            <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={1200} placeholder="Ex.: tom mais emocional, abrir com uma pergunta." />
          </details>
          <div className="notice info">A IA usa toda a história da ideia (dor, impacto, causa, guia, plano, ganho, desejo e CTA) e a ideia passa a constar como <b>já usada</b>. {isScript ? 'O roteiro fica pronto para revisar e editar.' : 'O post chega como rascunho no editor.'}</div>
          {!hasKey && <div className="notice warn">A IA não está configurada neste servidor (falta a <code>ANTHROPIC_API_KEY</code>).</div>}
          {busy && <div className="notice info" role="status">A IA está escrevendo o roteiro. Leva cerca de 20 a 40 segundos; mantenha esta janela aberta.</div>}
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          <span className="muted">≈ {fmtUsd(isScript ? ESTIMATED_COST_PER_SCRIPT : 0.035)}</span>
          <button type="button" className="btn primary" onClick={go} disabled={working || !hasKey || !ready}>{working ? (isScript ? 'Gerando…' : 'Criando…') : <><IconSpark /> {isScript ? 'Gerar roteiro' : 'Gerar post'}</>}</button>
        </footer>
      </div>
    </div>
  );
}
