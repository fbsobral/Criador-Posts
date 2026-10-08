'use client';

import { useEffect, useRef, useState } from 'react';

/** Editor em iframe com um loader até ele terminar de carregar. */
export function EditorFrame({ src, title }: { src: string; title: string }) {
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // o iframe pode já ter carregado antes da hidratação
    if (ref.current?.contentDocument?.readyState === 'complete' && ref.current.contentDocument.body?.children.length) setLoading(false);
    const t = setTimeout(() => setLoading(false), 20000); // nunca deixa o loader preso
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="frame-wrap">
      <iframe ref={ref} src={src} title={title} onLoad={() => setLoading(false)} />
      {loading && (
        <div className="loader-overlay" role="status" aria-live="polite">
          <div className="spinner" />
          <b>Abrindo o editor…</b>
          <span>Carregando seu post e as fontes</span>
        </div>
      )}
    </div>
  );
}
