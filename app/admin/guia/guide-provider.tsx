'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GENERAL_KEY, GUIDES, guideKeyForPath, type GuideIcon } from '@/lib/guides';
import { markGuideSeen, resetGuides } from '@/lib/onboarding-actions';
import { IconBoard, IconBulb, IconCheck, IconHelp, IconImage, IconMap, IconPosts, IconSettings, IconSpark, IconTarget, IconTemplates, IconUsers, IconVideo } from '../../icons';

const ICONS: Record<GuideIcon, () => React.ReactElement> = {
  spark: IconSpark, posts: IconPosts, image: IconImage, templates: IconTemplates, video: IconVideo, board: IconBoard, target: IconTarget, map: IconMap, bulb: IconBulb, settings: IconSettings, users: IconUsers, check: IconCheck, help: IconHelp,
};

type Ctx = { open: (key: string) => void; reset: () => Promise<void>; currentKey: string | null };
const GuideCtx = createContext<Ctx | null>(null);
export const useGuides = () => useContext(GuideCtx);

/** Tour geral (primeiro acesso) e guias por módulo (primeira visita a cada módulo). Os guias já vistos ficam salvos por usuário. */
export function GuideProvider({ seen, children }: { seen: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const [seenSet, setSeenSet] = useState(() => new Set(seen));
  const [active, setActive] = useState<string | null>(null);
  const dismissed = useRef(new Set<string>()); // já fechados nesta sessão (mesmo que salvar tenha falhado)
  const currentKey = guideKeyForPath(path);
  const keyRef = useRef(currentKey); keyRef.current = currentKey;

  const open = useCallback((key: string) => { if (GUIDES[key]) setActive(key); }, []);
  const finish = useCallback((key: string) => {
    dismissed.current.add(key);
    // depois do tour geral, o guia da página atual não abre logo em seguida: aparece na próxima visita ao módulo
    if (key === GENERAL_KEY && keyRef.current) dismissed.current.add(keyRef.current);
    setSeenSet((s) => new Set(s).add(key));
    setActive(null);
    markGuideSeen(key).catch(() => { /* sem conexão: o guia volta na próxima visita */ });
  }, []);
  const reset = useCallback(async () => {
    dismissed.current.clear(); setSeenSet(new Set());
    await resetGuides().catch(() => ({}));
  }, []);

  // abre sozinho: primeiro o tour geral; depois, o guia do módulo da página (uma vez)
  useEffect(() => {
    if (active) return;
    const next = !seenSet.has(GENERAL_KEY) ? GENERAL_KEY : currentKey && !seenSet.has(currentKey) ? currentKey : null;
    if (!next || dismissed.current.has(next)) return;
    const t = setTimeout(() => setActive(next), next === GENERAL_KEY ? 500 : 900);
    return () => clearTimeout(t);
  }, [path, seenSet, active, currentKey]);

  return (
    <GuideCtx.Provider value={{ open, reset, currentKey }}>
      {children}
      {active && <GuideModal key={active} guideKey={active} onClose={() => finish(active)} />}
    </GuideCtx.Provider>
  );
}

function GuideModal({ guideKey, onClose }: { guideKey: string; onClose: () => void }) {
  const g = GUIDES[guideKey];
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const last = i === g.steps.length - 1;
  const st = g.steps[i];
  const Icon = ICONS[st.icon];

  const go = useCallback((n: number) => setI((v) => Math.min(g.steps.length - 1, Math.max(0, v + n))), [g.steps.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [go, onClose]);

  return (
    <div className="gd-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gd-modal" role="dialog" aria-modal="true" aria-labelledby="gd-title" ref={box} tabIndex={-1}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }}>
        <div className="gd-top">
          <span className="gd-kicker">{guideKey === GENERAL_KEY ? 'Tour inicial' : `Guia · ${g.title}`}</span>
          <button type="button" className="gd-skip" onClick={onClose}>{last ? 'Fechar' : 'Pular'}</button>
        </div>
        <div className="gd-prog" role="tablist" aria-label="Passos">
          {g.steps.map((_, k) => <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Passo ${k + 1} de ${g.steps.length}`} className={k <= i ? 'on' : ''} onClick={() => setI(k)} />)}
        </div>
        <div className="gd-body" key={i}>
          <span className="gd-ic"><Icon /></span>
          {i === 0 && guideKey !== GENERAL_KEY && <p className="gd-sub">{g.subtitle}</p>}
          <h2 id="gd-title">{st.title}</h2>
          <p className="gd-text">{st.text}</p>
          {st.bullets && <ul className="gd-list">{st.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>}
          {st.tip && <div className="gd-tip"><b>Dica</b>{st.tip}</div>}
        </div>
        <div className="gd-foot">
          <button type="button" className="btn" onClick={() => go(-1)} disabled={i === 0}>Voltar</button>
          <span className="gd-count">{i + 1} / {g.steps.length}</span>
          {!last
            ? <button type="button" className="btn primary" onClick={() => go(1)}>Próximo</button>
            : g.cta
              ? <Link href={g.cta.href} className="btn primary" onClick={onClose}>{g.cta.label}</Link>
              : <button type="button" className="btn primary" onClick={onClose}>Entendi</button>}
        </div>
      </div>
    </div>
  );
}

/** Botão ? do menu: guia da página atual, tour inicial e reiniciar as dicas. */
export function HelpButton() {
  const g = useGuides();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!g) return null;
  const mod = g.currentKey ? GUIDES[g.currentKey] : null;
  return (
    <div className="gd-help" ref={ref}>
      <button type="button" className="gd-help-btn" onClick={() => { setOpen((o) => !o); setDone(''); }} aria-haspopup="menu" aria-expanded={open} aria-label="Ajuda e guias" title="Ajuda e guias"><IconHelp /></button>
      {open && (
        <div className="gd-pop" role="menu">
          {mod && <button type="button" role="menuitem" onClick={() => { setOpen(false); g.open(mod.key); }}><b>Guia desta página</b><small>{mod.title}: {mod.subtitle}</small></button>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); g.open(GENERAL_KEY); }}><b>Tour inicial</b><small>O que a plataforma faz, em 2 minutos</small></button>
          <button type="button" role="menuitem" onClick={async () => { await g.reset(); setDone('Pronto: os guias vão aparecer de novo em cada módulo.'); }}><b>Reiniciar as dicas</b><small>Mostra o tour e os guias de novo</small></button>
          {done && <p className="gd-done" role="status">{done}</p>}
        </div>
      )}
    </div>
  );
}
