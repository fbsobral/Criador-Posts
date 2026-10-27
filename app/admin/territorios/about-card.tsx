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

  if (editing) {
    return (
      <div className="card-surface tr-about editing">
        <label htmlFor="about"><b>O que a organização faz</b></label>
        <p className="muted">É a base dos territórios: eles nascem do que a persona busca <b>e</b> do que a sua organização pode falar com autoridade. Também alimenta personas, posts e roteiros.</p>
        <textarea id="about" rows={8} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} placeholder={GUIDE} autoFocus />
        <div className="tr-about-foot">
          <small className="muted">{text.length}/3000</small>
          {err && <span className="vd-err">{err}</span>}
          <div className="row-actions">
            <button type="button" className="btn small" onClick={() => { setText(about); setEditing(false); setErr(''); }}>Cancelar</button>
            <button type="button" className="btn small primary" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-surface tr-about${empty ? ' empty' : ''}`}>
      <div>
        <b>O que a organização faz</b>
        {empty
          ? <p>Defina o que a organização faz. Os territórios ficam muito mais úteis quando partem da <b>sua oferta e dos temas em que você quer ser referência</b>, e não só do que a persona procura.</p>
          : <p className="tr-about-text">{about.length > 340 ? `${about.slice(0, 340)}…` : about}</p>}
      </div>
      {canEdit
        ? <button type="button" className={`btn small${empty ? ' primary' : ''}`} onClick={() => { setText(about); setEditing(true); }}><IconEdit /> {empty ? 'Descrever' : 'Editar'}</button>
        : empty && <small className="muted">Peça a um administrador para preencher.</small>}
    </div>
  );
}
