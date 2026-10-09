'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { generateCaption, saveCaption } from '@/lib/actions';
import { NETWORKS, type Network } from '@/lib/ai/networks';
import { IconText } from '../../icons';

/** Botão "Legenda" da barra do editor: ver, editar, copiar e gerar/ajustar a legenda do post com IA. */
export function CaptionPanel({ id, initial, aiEnabled }: { id: string; initial: string; aiEnabled: boolean }) {
  const [text, setText] = useState(initial);
  const [network, setNetwork] = useState<Network>('instagram');
  const [instruction, setInstruction] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const saved = useRef(initial);
  const limit = NETWORKS[network].limit;
  const over = text.length > limit;

  useEffect(() => { if (!msg || pending) return; const t = setTimeout(() => setMsg(''), 3500); return () => clearTimeout(t); }, [msg, pending]);

  const persist = async () => {
    if (text === saved.current) return;
    const r = await saveCaption(id, text);
    if (r.ok) { saved.current = text; setMsg('Legenda salva ✓'); }
  };
  const generate = () => start(async () => {
    setMsg(text.trim() ? 'Ajustando a legenda…' : 'Criando a legenda…');
    const r = await generateCaption(id, network, instruction);
    if (r.error) { setMsg(r.error); return; }
    setText(r.caption ?? ''); saved.current = r.caption ?? ''; setInstruction(''); setMsg('Legenda pronta ✓');
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg('Copiada ✓'); } catch { setMsg('Não foi possível copiar. Selecione e copie à mão.'); }
  };

  return (
    <details className="rename-pop">
      <summary className="btn small ghost cap-btn" title="Legenda do post" aria-label="Legenda do post"><IconText /> <span>Legenda</span>{initial.trim() && <i className="cap-dot" aria-hidden />}</summary>
      <div className="card-surface rename-form migrate-form caption-form">
        <b>Legenda do post</b>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={persist} rows={9} placeholder="Ainda sem legenda. Clique em “Gerar legenda” ou escreva a sua." aria-label="Legenda" />
        <div className="cap-meta">
          <select value={network} onChange={(e) => setNetwork(e.target.value as Network)} aria-label="Rede">{Object.entries(NETWORKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <span className={over ? 'cap-over' : 'muted'}>{text.length}/{limit}{over ? ' · passou do limite' : ''}</span>
        </div>
        {aiEnabled && (
          <>
            <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={text.trim() ? 'Pedir ajuste: mais curta, sem hashtags, tom mais direto…' : 'Instrução opcional: foco em conversão, pergunta no fim…'} maxLength={600} aria-label="Instrução para a IA" />
            <div className="cap-actions">
              <button type="button" className="btn small primary" onClick={generate} disabled={pending}>{pending ? 'Gerando…' : text.trim() ? '↻ Regerar / ajustar' : '✨ Gerar legenda'}</button>
              <button type="button" className="btn small" onClick={copy} disabled={!text.trim()}>Copiar</button>
            </div>
          </>
        )}
        {!aiEnabled && <button type="button" className="btn small" onClick={copy} disabled={!text.trim()}>Copiar</button>}
        <small className={msg.includes('✓') ? 'cap-ok' : 'muted'} role="status">{msg || `Usa o tom de voz e as regras de legenda da marca. A legenda é adaptada para ${NETWORKS[network].label} ao gerar.`}</small>
      </div>
    </details>
  );
}
