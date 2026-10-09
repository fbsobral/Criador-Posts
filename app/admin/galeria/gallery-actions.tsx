'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconTrash } from '../../icons';

/** Redimensiona no navegador (máx. 1600 px) antes de enviar. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const r = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

export function UploadButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<string>('');

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let ok = 0, fail = 0;
    for (const [i, f] of [...files].entries()) {
      setState(`Enviando ${i + 1}/${files.length}…`);
      try {
        const r = await fetch('/api/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: await toDataUrl(f), description: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') }) });
        r.ok ? ok++ : fail++;
      } catch { fail++; }
    }
    setState(fail ? `${ok} enviada(s), ${fail} com erro` : `${ok} ${ok === 1 ? 'imagem enviada' : 'imagens enviadas'} ✓`);
    if (input.current) input.current.value = '';
    router.refresh();
    setTimeout(() => setState(''), 4000);
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button type="button" className="btn primary" onClick={() => input.current?.click()} disabled={!!state && state.startsWith('Enviando')}><IconPlus /> Enviar imagens</button>
      {state && <span className="muted" role="status">{state}</span>}
    </>
  );
}

export function DeleteAsset({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm('Excluir esta imagem da galeria?')) return;
    setBusy(true);
    const r = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Não foi possível excluir.'); return; }
    router.refresh();
  }
  return <button type="button" className="btn small ghost danger" onClick={del} disabled={busy} title="Excluir" aria-label="Excluir"><IconTrash /></button>;
}
