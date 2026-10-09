'use client';

import { useState } from 'react';

/** Mostra a legenda gerada e deixa copiar com um clique. */
export function CopyCaption({ text }: { text: string }) {
  const [ok, setOk] = useState<null | boolean>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setOk(true); } catch { setOk(false); }
    setTimeout(() => setOk(null), 2500);
  }
  return (
    <details className="gen-cap">
      <summary>Legenda pronta ({text.length} caracteres)</summary>
      <p>{text}</p>
      <button type="button" className="btn small" onClick={copy}>{ok === true ? 'Copiada ✓' : ok === false ? 'Não foi possível copiar' : 'Copiar legenda'}</button>
    </details>
  );
}
