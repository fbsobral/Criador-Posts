'use client';

import { useActionState, useState } from 'react';
import { convertPost, type ConvertState } from '@/lib/actions';
import { IconSwap } from '../../icons';

/** Botão "Converter para Tweet Card / Carrossel": janela com a quantidade de cards/slides desejada. */
export function ConvertButton({ id, editor, slides }: { id: string; editor: 'carrossel' | 'tweet'; slides: number }) {
  const [state, action, pending] = useActionState<ConvertState, FormData>(convertPost, null);
  const toTweet = editor === 'carrossel';
  const [n, setN] = useState(Math.min(12, Math.max(1, slides || 5)));
  const noun = toTweet ? 'cards' : 'slides';
  const presets = [3, 5, 7, 9].filter((v) => v !== n).slice(0, 3);

  return (
    <details className="rename-pop">
      <summary className="btn small ghost" title={toTweet ? 'Converter em Tweet Card' : 'Converter em carrossel'} aria-label={toTweet ? 'Converter em Tweet Card' : 'Converter em carrossel'}><IconSwap /></summary>
      <form action={action} className="card-surface rename-form migrate-form">
        <b>Converter em {toTweet ? 'Tweet Card' : 'carrossel'}</b>
        <small className="muted">A IA reescreve o conteúdo para o novo formato e cria um <b>novo rascunho</b>. O post original não muda.</small>
        <input type="hidden" name="id" value={id} />
        <label className="conv-n">Quantos {noun}?
          <input type="number" name="slides" min={1} max={12} value={n} onChange={(e) => setN(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} required />
        </label>
        <div className="conv-presets">
          <span className="muted">Atalhos:</span>
          {presets.map((v) => <button type="button" key={v} onClick={() => setN(v)}>{v}</button>)}
          {slides > 0 && slides !== n && <button type="button" onClick={() => setN(Math.min(12, slides))}>{Math.min(12, slides)} (igual ao original)</button>}
        </div>
        {state?.error && <small className="conv-err" role="alert">{state.error}</small>}
        <button className="btn small primary" disabled={pending}>{pending ? 'Convertendo… (cerca de 20 s)' : `Converter (≈ US$ 0,03)`}</button>
      </form>
    </details>
  );
}
