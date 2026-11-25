'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ditado por voz em todos os campos de texto do app: um microfone sempre visível no canto do campo.
 * Usa o reconhecimento de voz do próprio navegador (Chrome, Edge, Safari): no primeiro uso o navegador pede a permissão do microfone.
 * O texto falado entra onde está o cursor, e o campo reage como se a pessoa tivesse digitado (vale também para o editor de texto corrido do roteiro).
 * Para um campo ficar sem o microfone: data-no-voice no campo ou em um elemento acima dele.
 */

type Field = HTMLElement;
type Result = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecCtor = new () => Rec;
type Item = { el: Field; id: number; x: number; y: number };

const OK_TYPES = new Set(['text', 'search']);
const SKIP_NAME = /pass|senha|e-?mail|user|login|code|codigo|cpf|cnpj|phone|tel|url|slug|hex|cor\b/i;
const isText = (el: Field): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function eligible(t: Element): t is Field {
  if (!(t instanceof HTMLElement)) return false;
  if (t instanceof HTMLInputElement) { if (!OK_TYPES.has(t.type)) return false; }
  else if (t instanceof HTMLTextAreaElement) { /* ok */ }
  else if (!(t.getAttribute('contenteditable') === 'true' && t.isContentEditable)) return false;
  if (isText(t) && (t.readOnly || t.disabled)) return false;
  if (t.closest('[data-no-voice], .cl-rootBox, .cl-component')) return false;
  if (SKIP_NAME.test(`${t.getAttribute('name') ?? ''} ${t.getAttribute('autocomplete') ?? ''}`)) return false;
  return t.getBoundingClientRect().width >= 160;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true })); // o React lê o campo por este evento
}

const BLOCKED = 'O navegador não liberou o microfone. Clique no cadeado ao lado do endereço, permita o microfone e tente de novo.';
const MSG: Record<string, string> = {
  'not-allowed': BLOCKED, 'service-not-allowed': BLOCKED,
  'audio-capture': 'Não encontrei um microfone neste aparelho.',
  network: 'Sem conexão com o serviço de voz do navegador.',
  'no-speech': 'Não ouvi nada. Clique no microfone e fale de novo.',
};

export function VoiceInput() {
  const [items, setItems] = useState<Item[]>([]);
  const [listeningEl, setListeningEl] = useState<Field | null>(null);
  const [asking, setAsking] = useState<Field | null>(null); // esperando a pessoa responder o pedido de permissão do navegador
  const [msg, setMsg] = useState<{ el: Field; text: string } | null>(null);
  const rec = useRef<{ r: Rec; el: Field; want: boolean } | null>(null);
  const ids = useRef(new WeakMap<Field, number>());
  const seq = useRef(0);

  const stop = () => {
    const c = rec.current; if (!c) return;
    c.want = false; rec.current = null; setListeningEl(null); setAsking(null);
    c.r.onend = null; c.r.onresult = null; c.r.onerror = null;
    try { c.r.stop(); } catch { /* já parou */ }
  };
  const fail = (el: Field, text: string) => { setMsg({ el, text }); };

  const begin = (el: Field) => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { fail(el, 'Este navegador não oferece ditado por voz. Use o Chrome, o Edge ou o Safari atualizado.'); return; }
    stop(); setMsg(null);
    const cur: { r: Rec; el: Field; want: boolean } = { r: null as unknown as Rec, el, want: true };
    let quick = 0, heard = false;
    // campos comuns: o texto falado entra no lugar do cursor e vai se atualizando enquanto a pessoa fala
    let before = '', after = '', caret = 0;
    const capture = () => { if (isText(el)) { const s0 = el.selectionStart ?? el.value.length, e0 = el.selectionEnd ?? s0; before = el.value.slice(0, s0); after = el.value.slice(e0); caret = s0; } };
    // editor de texto corrido: só o que o navegador já confirmou entra, no lugar do cursor
    let saved: Range | null = null;
    const sel0 = window.getSelection();
    if (!isText(el) && sel0 && sel0.rangeCount && el.contains(sel0.anchorNode)) saved = sel0.getRangeAt(0).cloneRange();
    capture();
    const insertRich = (text: string) => {
      const s = window.getSelection(); if (!s) return;
      el.focus();
      if (saved) { s.removeAllRanges(); s.addRange(saved); } else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
      const n = s.anchorNode, off = s.anchorOffset;
      const prev = n && n.nodeType === 3 && off > 0 ? (n.textContent ?? '')[off - 1] : '';
      const next = n && n.nodeType === 3 ? (n.textContent ?? '')[off] : '';
      document.execCommand('insertText', false, (prev && !/\s/.test(prev) ? ' ' : '') + text.trim() + (next && !/\s/.test(next) ? ' ' : ''));
      if (s.rangeCount) saved = s.getRangeAt(0).cloneRange();
    };
    const run = () => {
      const r = new Ctor(); cur.r = r;
      r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
      const sp = before && !/\s$/.test(before) ? ' ' : '';
      const startedAt = Date.now();
      r.onresult = (ev) => {
        if (!heard) { heard = true; setAsking(null); }
        if (!isText(el)) {
          let fin = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) fin += ev.results[i][0].transcript;
          if (fin.trim()) insertRich(fin);
          return;
        }
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
        cur.want = false; if (rec.current === cur) { rec.current = null; setListeningEl(null); setAsking(null); }
        if (MSG[e.error]) fail(el, MSG[e.error]);
      };
      r.onend = () => {
        // o navegador encerra o ditado depois de um tempo ou de um silêncio: continua de onde parou, a menos que a pessoa tenha parado
        if (!cur.want || !el.isConnected) { if (rec.current === cur) { rec.current = null; setListeningEl(null); setAsking(null); } return; }
        quick = Date.now() - startedAt < 700 ? quick + 1 : 0;
        if (quick >= 2) { cur.want = false; rec.current = null; setListeningEl(null); setAsking(null); return; }
        if (isText(el)) { before = el.value.slice(0, caret); after = el.value.slice(caret); }
        run();
      };
      try { r.start(); } catch { cur.want = false; rec.current = null; setListeningEl(null); setAsking(null); }
    };
    rec.current = cur; setListeningEl(el); setAsking(el); run();
    // sem resposta rápida, o navegador provavelmente está mostrando o pedido de permissão
  };

  // acha os campos de texto da página e acompanha onde eles estão na tela
  useEffect(() => {
    let raf = 0, last = '', list: Field[] = [], scanned = 0;
    const scan = () => {
      list = [...document.querySelectorAll('textarea, input, [contenteditable="true"]')].filter(eligible);
      let grew = false;
      for (const el of list) if (!el.hasAttribute('data-voice')) { el.setAttribute('data-voice', ''); grew = true; } // abre espaço para o microfone
      if (grew) window.dispatchEvent(new Event('resize')); // as caixas que crescem com o texto se ajustam
    };
    const tick = (now: number) => {
      if (now - scanned > 500) { scanned = now; scan(); }
      const next: Item[] = [];
      for (const el of list) {
        if (!el.isConnected) continue;
        const r = el.getBoundingClientRect();
        const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);
        if (bottom - top < 30 || r.right < 40 || r.left > window.innerWidth) continue;
        const single = !(el instanceof HTMLTextAreaElement) && r.height < 70;
        let id = ids.current.get(el); if (!id) { id = ++seq.current; ids.current.set(el, id); }
        const x = Math.round(Math.min(r.right, window.innerWidth) - 34), y = Math.round(single ? r.top + (r.height - 28) / 2 : Math.max(top + 4, bottom - 34));
        // escondido atrás de outra coisa (janela aberta por cima, menu fixo)? não mostra
        const hit = document.elementFromPoint(x + 14, Math.min(Math.max(y + 14, 0), window.innerHeight - 1));
        if (hit && !hit.closest('.voice-wrap') && !el.contains(hit) && !hit.contains(el)) continue;
        next.push({ el, id, x, y });
      }
      const key = next.map((i) => `${i.id}:${i.x}:${i.y}`).join('|');
      if (key !== last) { last = key; setItems(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!asking) return; const x = setTimeout(() => setAsking(null), 7000); return () => clearTimeout(x); }, [asking]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 8000); return () => clearTimeout(t); }, [msg]);

  return (
    <>
      {items.map((it) => {
        const on = listeningEl === it.el, wait = asking === it.el;
        return (
          <div key={it.id} className="voice-wrap" style={{ left: it.x, top: it.y }}>
            {msg?.el === it.el && <div className="voice-msg" role="alert">{msg.text}</div>}
            {wait && !msg && <div className="voice-msg ask" role="status">Se o navegador pedir, clique em “Permitir” para usar o microfone.</div>}
            <button
              type="button" className={`voice-btn${on ? ' on' : ''}`} data-no-voice
              onMouseDown={(e) => e.preventDefault()} // não tira o cursor do campo
              onClick={() => { if (on) stop(); else { if (isText(it.el)) it.el.focus(); begin(it.el); } }}
              aria-pressed={on} aria-label={on ? 'Parar de ditar' : 'Ditar por voz'} title={on ? 'Ouvindo… clique para parar' : 'Ditar por voz (o navegador pede permissão do microfone)'}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
          </div>
        );
      })}
    </>
  );
}
