'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ditado por voz em todos os campos de texto do app: um microfone no canto do campo (aparece ao passar o mouse ou ao clicar no campo).
 * Usa o reconhecimento de voz do próprio navegador (Chrome, Edge, Safari): o navegador pede a permissão do microfone no primeiro uso.
 * O texto falado entra onde está o cursor, e o campo reage como se a pessoa tivesse digitado.
 * Para um campo ficar sem o microfone: data-no-voice no campo ou em um elemento acima dele.
 */

type Field = HTMLInputElement | HTMLTextAreaElement;
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecCtor = new () => Rec;

const OK_TYPES = new Set(['text', 'search']);
const SKIP_NAME = /pass|senha|e-?mail|user|login|code|codigo|cpf|cnpj|phone|tel|url|slug|hex|cor\b/i;

function eligible(t: EventTarget | null): t is Field {
  if (!(t instanceof HTMLElement)) return false;
  if (t instanceof HTMLInputElement) { if (!OK_TYPES.has(t.type)) return false; }
  else if (!(t instanceof HTMLTextAreaElement)) return false;
  if (t.readOnly || t.disabled || t.closest('[data-no-voice], .cl-rootBox, .cl-component')) return false;
  if (SKIP_NAME.test(`${t.getAttribute('name') ?? ''} ${t.getAttribute('autocomplete') ?? ''}`)) return false;
  return t.getBoundingClientRect().width >= 160;
}

function setValue(el: Field, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true })); // o React lê o campo por este evento
}

const MSG: Record<string, string> = {
  'not-allowed': 'O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço, permita o microfone e tente de novo.',
  'service-not-allowed': 'O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço, permita o microfone e tente de novo.',
  'audio-capture': 'Não encontrei um microfone neste aparelho.',
  network: 'Sem conexão com o serviço de voz do navegador.',
  'no-speech': 'Não ouvi nada. Clique no microfone e fale de novo.',
};

export function VoiceInput() {
  const [supported, setSupported] = useState(false);
  const [target, setTarget] = useState<Field | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [msg, setMsg] = useState('');
  const focused = useRef<Field | null>(null);
  const hovered = useRef<Field | null>(null);
  const overBtn = useRef(false);
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rec = useRef<{ r: Rec; el: Field; want: boolean } | null>(null);
  const targetRef = useRef<Field | null>(null); targetRef.current = target;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    if (!(w.SpeechRecognition || w.webkitSpeechRecognition)) return;
    setSupported(true);
  }, []);

  const stop = () => {
    const c = rec.current; if (!c) return;
    c.want = false; rec.current = null; setListening(false);
    c.r.onend = null; c.r.onresult = null; c.r.onerror = null;
    try { c.r.stop(); } catch { /* já parou */ }
  };

  const begin = (el: Field) => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition; if (!Ctor) return;
    stop(); setMsg('');
    const s0 = el.selectionStart ?? el.value.length, e0 = el.selectionEnd ?? s0;
    let before = el.value.slice(0, s0), after = el.value.slice(e0), caret = s0, quick = 0;
    const cur: { r: Rec; el: Field; want: boolean } = { r: new Ctor(), el, want: true };
    const run = () => {
      const r = new Ctor(); cur.r = r;
      r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
      const sp = before && !/\s$/.test(before) ? ' ' : '';
      const startedAt = Date.now();
      r.onresult = (ev) => {
        let said = '';
        for (let i = 0; i < ev.results.length; i++) said += ev.results[i][0].transcript;
        said = said.replace(/^\s+/, '');
        const gap = after && !/^\s/.test(after) ? ' ' : '';
        const room = el.maxLength > 0 ? el.maxLength - before.length - sp.length - after.length - gap.length : Infinity;
        if (said.length > room) said = said.slice(0, Math.max(0, room));
        const head = before + sp + said;
        setValue(el, head + gap + after);
        caret = head.length;
        try { el.setSelectionRange(caret, caret); } catch { /* campo sem seleção */ }
      };
      r.onerror = (e) => {
        if (e.error === 'aborted') return;
        cur.want = false; if (rec.current === cur) { rec.current = null; setListening(false); }
        if (MSG[e.error]) setMsg(MSG[e.error]);
      };
      r.onend = () => {
        // o navegador encerra o ditado depois de um tempo ou de um silêncio: continua de onde parou, a menos que a pessoa tenha parado
        if (!cur.want || !el.isConnected) { if (rec.current === cur) { rec.current = null; setListening(false); } return; }
        quick = Date.now() - startedAt < 700 ? quick + 1 : 0;
        if (quick >= 2) { cur.want = false; rec.current = null; setListening(false); return; }
        before = el.value.slice(0, caret); after = el.value.slice(caret);
        run();
      };
      try { r.start(); } catch { cur.want = false; rec.current = null; setListening(false); }
    };
    rec.current = cur; setListening(true); run();
  };

  // qual campo mostra o microfone: o que está com o cursor, senão o que está sob o mouse
  useEffect(() => {
    if (!supported) return;
    const pick = () => {
      clearTimeout(hideT.current);
      const el = rec.current?.el ?? (eligible(focused.current) ? focused.current : eligible(hovered.current) ? hovered.current : null);
      if (el && !el.hasAttribute('data-voice')) { el.setAttribute('data-voice', ''); window.dispatchEvent(new Event('resize')); } // abre espaço para o microfone; as caixas que crescem com o texto se ajustam
      setTarget(el);
    };
    const later = () => { clearTimeout(hideT.current); hideT.current = setTimeout(() => { if (!overBtn.current) pick(); }, 250); };
    const onFocusIn = (e: FocusEvent) => {
      if (eligible(e.target)) { if (rec.current && rec.current.el !== e.target) stop(); focused.current = e.target; pick(); }
    };
    const onFocusOut = (e: FocusEvent) => { if (focused.current === e.target) focused.current = null; later(); };
    const onOver = (e: MouseEvent) => { const t = (e.target as HTMLElement | null)?.closest?.('textarea, input') ?? null; if (eligible(t)) { hovered.current = t; pick(); } };
    const onOut = (e: MouseEvent) => { if (hovered.current === (e.target as Element)) { hovered.current = null; later(); } };
    document.addEventListener('focusin', onFocusIn); document.addEventListener('focusout', onFocusOut);
    document.addEventListener('mouseover', onOver); document.addEventListener('mouseout', onOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('mouseover', onOver); document.removeEventListener('mouseout', onOut);
      clearTimeout(hideT.current); stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  // acompanha o campo (rolagem, campo que cresce, janela redimensionada)
  useEffect(() => {
    if (!target) { setPos(null); return; }
    let raf = 0, last = '';
    const tick = () => {
      if (!target.isConnected) { setTarget(null); return; }
      const r = target.getBoundingClientRect();
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);
      const key = `${Math.round(r.right)}|${Math.round(top)}|${Math.round(bottom)}`;
      if (key !== last) {
        last = key;
        if (bottom - top < 24 || r.right < 0 || r.left > window.innerWidth) setPos(null);
        else {
          const single = target instanceof HTMLInputElement || r.height < 50;
          setPos({ x: Math.min(r.right, window.innerWidth) - 34, y: single ? r.top + (r.height - 28) / 2 : Math.max(top + 4, bottom - 34) });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 7000); return () => clearTimeout(t); }, [msg]);
  useEffect(() => { if (!target && !listening) setMsg(''); }, [target, listening]);

  if (!supported || !target || !pos) return null;
  return (
    <div className="voice-wrap" style={{ left: pos.x, top: pos.y }} onMouseEnter={() => { overBtn.current = true; clearTimeout(hideT.current); }} onMouseLeave={() => { overBtn.current = false; }}>
      {msg && <div className="voice-msg" role="alert">{msg}</div>}
      <button
        type="button" className={`voice-btn${listening ? ' on' : ''}`} data-no-voice
        onMouseDown={(e) => e.preventDefault()} // não tira o cursor do campo
        onClick={() => { if (listening) stop(); else { target.focus(); begin(target); } }}
        aria-pressed={listening} aria-label={listening ? 'Parar de ditar' : 'Ditar por voz'} title={listening ? 'Ouvindo… clique para parar' : 'Ditar por voz (o navegador pede permissão do microfone)'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
    </div>
  );
}
