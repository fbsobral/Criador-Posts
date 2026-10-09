'use client';

import { useRef, useState } from 'react';

/** Redimensiona no navegador (máx. 600 px; PNG mantém transparência) antes de enviar. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const r = Math.min(1, 600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

/** Foto de perfil da marca: enviada na hora; a referência vai junto com o formulário (campo avatarUrl). */
export function AvatarField({ initialUrl, disabled }: { initialUrl: string | null; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true); setMsg('Enviando…');
    try {
      const r = await fetch('/api/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: await toDataUrl(file), kind: 'avatar' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível enviar a foto.');
      setUrl(j.url); setMsg('Foto enviada. Clique em "Salvar alterações" para aplicar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao enviar a foto.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="avatar-field">
      <input type="hidden" name="avatarUrl" value={url} />
      <div className="avatar-preview" style={url ? { backgroundImage: `url("${url}")` } : undefined} aria-label="Foto de perfil">
        {!url && <svg viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="38" r="20" fill="#5b4a40" /><path d="M12 100c2-24 18-36 38-36s36 12 38 36z" fill="#6c6f78" /></svg>}
      </div>
      <div className="avatar-side">
        <b>Foto de perfil</b>
        <small className="muted">Aparece automaticamente em todos os posts novos (criados à mão ou gerados com IA).</small>
        <div className="row-actions">
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" className="btn small" disabled={disabled || busy} onClick={() => input.current?.click()}>{url ? 'Trocar foto' : 'Enviar foto'}</button>
          {url && <button type="button" className="btn small ghost danger" disabled={disabled || busy} onClick={() => { setUrl(''); setMsg('Foto removida. Clique em "Salvar alterações".'); }}>Remover</button>}
        </div>
        {url && !disabled && (
          <label className="mini-check"><input type="checkbox" name="applyAvatarToPosts" /> Aplicar também aos posts existentes que ainda não têm foto</label>
        )}
        {msg && <small className="muted" role="status">{msg}</small>}
      </div>
    </div>
  );
}
