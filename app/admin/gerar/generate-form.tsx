'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { createBatch, type BatchState } from '@/lib/actions';
import { ESTIMATED_COST_PER_POST, ESTIMATED_IMAGES_PER_POST, IMAGE_COST_USD, MAX_ITEMS_PER_BATCH, fmtUsd, parseBriefs } from '@/lib/ai/constants';
import { IconPlus, IconSpark, IconTrash } from '../../icons';
import { TemplateArt } from '../template-art';

type Format = { id: string; name: string; description: string; editor: string };

const PLACEHOLDER = {
  tema: 'Um tema por linha. Ex.:\nPor que a dívida pública preocupa\n5 erros ao financiar um imóvel\nFinanciamento ou consórcio?',
  roteiro: 'Cole o roteiro deste post.\n\nSlide 1: Título forte...\nSlide 2: ...',
};
const SEP = /^\s*-{3,}\s*$/m;

export function GenerateForm({ formats, hasKey, hasImageKey }: { formats: Format[]; hasKey: boolean; hasImageKey: boolean }) {
  const [state, action, pending] = useActionState<BatchState, FormData>(createBatch, null);
  const [mode, setMode] = useState<'tema' | 'roteiro'>('tema');
  const [text, setText] = useState('');
  const [withImages, setWithImages] = useState(false);
  const [scripts, setScripts] = useState<string[]>(['']); // um cartão por roteiro
  const focusLast = useRef(false);
  const cards = useRef<(HTMLTextAreaElement | null)[]>([]);
  const filled = scripts.filter((t) => t.trim()).length;
  const count = useMemo(() => (mode === 'roteiro' ? filled : parseBriefs(text, mode).length), [text, mode, filled]);

  useEffect(() => {
    if (focusLast.current) { focusLast.current = false; cards.current[scripts.length - 1]?.focus(); }
  }, [scripts.length]);

  const setScript = (i: number, v: string) => setScripts((a) => a.map((x, k) => (k === i ? v : x)));
  const addScript = () => { focusLast.current = true; setScripts((a) => (a.length >= MAX_ITEMS_PER_BATCH ? a : [...a, ''])); };
  const removeScript = (i: number) => setScripts((a) => (a.length === 1 ? [''] : a.filter((_, k) => k !== i)));
  /** Texto colado com "---" no meio vira vários cartões. */
  const splitScript = (i: number) => {
    setScripts((a) => {
      if (!SEP.test(a[i])) return a;
      const parts = a[i].split(SEP).map((t) => t.trim()).filter(Boolean);
      return parts.length > 1 ? [...a.slice(0, i), ...parts, ...a.slice(i + 1)].slice(0, MAX_ITEMS_PER_BATCH) : a;
    });
  };
  const over = count > MAX_ITEMS_PER_BATCH;

  return (
    <form action={action} className="card-surface gen-form">
      <div className="seg" role="radiogroup" aria-label="Como gerar">
        <label className={mode === 'tema' ? 'on' : ''}>
          <input type="radio" name="mode" value="tema" checked={mode === 'tema'} onChange={() => setMode('tema')} />
          <b>Escrever a partir de temas</b><small>A IA cria o post inteiro</small>
        </label>
        <label className={mode === 'roteiro' ? 'on' : ''}>
          <input type="radio" name="mode" value="roteiro" checked={mode === 'roteiro'} onChange={() => setMode('roteiro')} />
          <b>Estruturar roteiros prontos</b><small>A IA só organiza em slides</small>
        </label>
      </div>

      <div>
        <div className="lbl">Formato</div>
        <div className="tpl-opts" style={{ marginBottom: 0 }}>
          {formats.map((t, i) => (
            <label className="tpl-opt" key={t.id}>
              <input type="radio" name="templateId" value={t.id} defaultChecked={i === 0} required />
              <TemplateArt editor={t.editor} className="art" />
              <span><b>{t.name}</b><small>{t.description || 'Formato de post'}</small></span>
            </label>
          ))}
        </div>
      </div>

      {mode === 'tema' ? (
        <label className="field">
          Temas (um por linha, até {MAX_ITEMS_PER_BATCH})
          <textarea name="briefs" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER.tema} required />
        </label>
      ) : (
        <div className="scripts">
          <div className="lbl">Roteiros ({filled} {filled === 1 ? 'preenchido' : 'preenchidos'}) · cada um vira um post</div>
          {scripts.map((t, i) => (
            <div className="script-card" key={i}>
              <div className="script-head">
                <b>Roteiro {i + 1}</b>
                <span className="muted">{t.trim() ? `${t.trim().split(/\s+/).length} palavras` : 'vazio'}</span>
                <button type="button" className="btn small ghost danger" onClick={() => removeScript(i)} aria-label={`Remover roteiro ${i + 1}`} title="Remover"><IconTrash /></button>
              </div>
              <textarea
                ref={(el) => { cards.current[i] = el; }}
                name="brief" rows={6} value={t} maxLength={6000}
                onChange={(e) => setScript(i, e.target.value)} onBlur={() => splitScript(i)}
                placeholder={PLACEHOLDER.roteiro}
              />
            </div>
          ))}
          <button type="button" className="add-script" onClick={addScript} disabled={scripts.length >= MAX_ITEMS_PER_BATCH}>
            <IconPlus /> Adicionar roteiro
          </button>
          <small className="muted">Dica: se colar vários roteiros de uma vez separados por uma linha com <code>---</code>, eu divido em cartões para você.</small>
        </div>
      )}

      <div className="gen-grid">
        {mode === 'tema' && (
          <label className="field">Slides por post
            <select name="slides" defaultValue="7">
              {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} slides</option>)}
            </select>
          </label>
        )}
        <label className="field" style={{ gridColumn: mode === 'tema' ? 'span 1' : 'span 2' }}>Instruções extras (opcional)
          <input name="instructions" maxLength={2000} placeholder="Ex.: foco em conversão, tom mais provocativo" />
        </label>
      </div>

      <label className="field">Dados e fatos que a IA pode usar (opcional)
        <textarea name="facts" rows={3} maxLength={8000} placeholder="Números e fontes reais. A IA não inventa dados: sem isso, ela escreve sem números." />
      </label>

      <label className={`img-opt${withImages ? ' on' : ''}${hasImageKey ? '' : ' off'}`}>
        <input type="checkbox" name="withImages" checked={withImages && hasImageKey} disabled={!hasImageKey} onChange={(e) => setWithImages(e.target.checked)} />
        <span>
          <b>Gerar também as imagens dos slides (Nano Banana)</b>
          <small>
            As imagens entram nos espaços de imagem do carrossel e do Tweet Card. Se o roteiro descrever a imagem, a IA melhora a descrição antes de gerar; se não descrever, ela cria a partir do texto do slide. Cerca de {fmtUsd(IMAGE_COST_USD)} por imagem, até 4 por post.
            {!hasImageKey && <> <b style={{ color: 'var(--danger)' }}>Indisponível: configure GEMINI_API_KEY no servidor.</b></>}
          </small>
        </span>
      </label>

      {!hasKey && <div className="notice warn">A chave da IA ainda não está configurada no servidor (<code>ANTHROPIC_API_KEY</code>).</div>}
      {state?.error && <div className="notice err" role="alert">{state.error}</div>}

      <div className="gen-foot">
        <div className="muted">
          {count > 0 ? <><b>{count}</b> {count === 1 ? 'post' : 'posts'} · estimativa <b>{fmtUsd(count * (ESTIMATED_COST_PER_POST + (withImages && hasImageKey ? ESTIMATED_IMAGES_PER_POST * IMAGE_COST_USD : 0)))}</b>{withImages && hasImageKey && <span className="muted"> (com imagens)</span>}</> : 'Nenhum item ainda'}
          {over && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>máx. {MAX_ITEMS_PER_BATCH} por lote</span>}
        </div>
        <button className="btn primary" disabled={pending || !count || over || !hasKey}>
          <IconSpark /> {pending ? 'Criando lote…' : count > 1 ? `Gerar ${count} posts` : 'Gerar post'}
        </button>
      </div>
    </form>
  );
}
