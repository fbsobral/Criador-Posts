'use client';

import { useActionState, useMemo, useState } from 'react';
import { createBatch, type BatchState } from '@/lib/actions';
import { ESTIMATED_COST_PER_POST, MAX_ITEMS_PER_BATCH, fmtUsd, parseBriefs } from '@/lib/ai/constants';
import { IconSpark } from '../../icons';
import { TemplateArt } from '../template-art';

type Format = { id: string; name: string; description: string; editor: string };

const PLACEHOLDER = {
  tema: 'Um tema por linha. Ex.:\nPor que a dívida pública preocupa\n5 erros ao financiar um imóvel\nFinanciamento ou consórcio?',
  roteiro: 'Cole o roteiro. Para enviar vários, separe com uma linha contendo ---\n\nSlide 1: Título forte...\nSlide 2: ...\n---\nOutro roteiro...',
};

export function GenerateForm({ formats, hasKey }: { formats: Format[]; hasKey: boolean }) {
  const [state, action, pending] = useActionState<BatchState, FormData>(createBatch, null);
  const [mode, setMode] = useState<'tema' | 'roteiro'>('tema');
  const [text, setText] = useState('');
  const count = useMemo(() => parseBriefs(text, mode).length, [text, mode]);
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

      <label className="field">
        {mode === 'tema' ? 'Temas (um por linha, até ' + MAX_ITEMS_PER_BATCH + ')' : 'Roteiros (separe com ---)'}
        <textarea name="briefs" rows={mode === 'tema' ? 7 : 10} value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER[mode]} required />
      </label>

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

      {!hasKey && <div className="notice warn">A chave da IA ainda não está configurada no servidor (<code>ANTHROPIC_API_KEY</code>).</div>}
      {state?.error && <div className="notice err" role="alert">{state.error}</div>}

      <div className="gen-foot">
        <div className="muted">
          {count > 0 ? <><b>{count}</b> {count === 1 ? 'post' : 'posts'} · estimativa <b>{fmtUsd(count * ESTIMATED_COST_PER_POST)}</b></> : 'Nenhum item ainda'}
          {over && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>máx. {MAX_ITEMS_PER_BATCH} por lote</span>}
        </div>
        <button className="btn primary" disabled={pending || !count || over || !hasKey}>
          <IconSpark /> {pending ? 'Criando lote…' : count > 1 ? `Gerar ${count} posts` : 'Gerar post'}
        </button>
      </div>
    </form>
  );
}
