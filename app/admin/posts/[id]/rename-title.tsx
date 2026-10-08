'use client';

import { useRef, useState } from 'react';

/** Título do post editável direto na barra do editor (Enter/blur salva, Esc cancela). */
export function RenameTitle({ id, title }: { id: string; title: string }) {
  const [saved, setSaved] = useState(title);
  const [value, setValue] = useState(title);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const input = useRef<HTMLInputElement>(null);

  async function commit() {
    const next = value.trim();
    if (!next) { setValue(saved); return; }
    if (next === saved) return;
    setState('saving');
    try {
      const r = await fetch(`/api/posts/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: next }) });
      if (!r.ok) throw new Error();
      setSaved(next); setValue(next); setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
    }
  }

  return (
    <div className="rename">
      <input
        ref={input}
        value={value}
        maxLength={120}
        aria-label="Título do post"
        title="Clique para renomear"
        onChange={(e) => { setValue(e.target.value); setState('idle'); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') input.current?.blur();
          if (e.key === 'Escape') { setValue(saved); input.current?.blur(); }
        }}
      />
      <span className={`rename-state ${state}`}>{state === 'saving' ? 'Salvando…' : state === 'saved' ? 'Salvo ✓' : state === 'error' ? 'Erro ao salvar' : ''}</span>
    </div>
  );
}
