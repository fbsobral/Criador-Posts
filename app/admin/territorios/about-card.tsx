'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveOrgAbout } from '@/lib/territory-actions';
import { IconEdit } from '../../icons';

const GUIDE = `Descreva com detalhes:
• O que a organização faz, vende ou oferece
• Para quem (quem é o cliente e que problema resolve)
• O que a diferencia
• Sobre quais temas quer ser referência
• O que ela NÃO faz (limites)`;

/** "O que a organização faz": a base dos territórios. Editável por administradores; vale para toda geração com IA. */
export function AboutCard({ about, canEdit }: { about: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(about);
  const [err, setErr] = useState('');
  const empty = !about.trim();

  const save = () => start(async () => {
    const r = await saveOrgAbout(text);
    if (r.error) { setErr(r.error); return; }
    setEditing(false); router.refresh();
  });

  const summary = about.replace(/\s+/g, ' ').trim();
  return (
    <>
      <div className={`tr-about${empty ? ' empty' : ''}`}>
        <span className="tr-about-label">O que a organização faz</span>
        <span className="tr-about-text" title={summary}>{empty ? 'Ainda não definido. Os territórios ficam mais úteis quando partem da sua oferta.' : summary}</span>
        {canEdit
          ? <button type="button" className={`btn small${empty ? ' primary' : ' ghost'}`} onClick={() => { setText(about); setEditing(true); }}><IconEdit /> {empty ? 'Descrever' : 'Editar'}</button>
          : empty && <small className="muted">Peça a um administrador.</small>}
      </div>
      {editing && (
        <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) { setText(about); setEditing(false); setErr(''); } }}>
          <div className="pe-modal" role="dialog" aria-modal="true" aria-label="O que a organização faz">
            <header><h2>O que a organização faz</h2><button type="button" className="btn small ghost" onClick={() => { setText(about); setEditing(false); setErr(''); }} aria-label="Fechar">✕</button></header>
            <div className="pe-modal-body">
              <p className="muted">É a base dos territórios: eles nascem do que a persona busca <b>e</b> do que a sua organização pode falar com autoridade. Também alimenta personas, posts e roteiros.</p>
              <textarea id="about" rows={10} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} placeholder={GUIDE} autoFocus />
              {err && <div className="notice err">{err}</div>}
            </div>
            <footer>
              <small className="muted">{text.length}/3000</small>
              <div className="row-actions">
                <button type="button" className="btn" onClick={() => { setText(about); setEditing(false); setErr(''); }}>Cancelar</button>
                <button type="button" className="btn primary" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
