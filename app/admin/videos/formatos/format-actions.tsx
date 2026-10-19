'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteFormat, duplicateFormat } from '@/lib/video-actions';
import { IconCopy, IconEdit, IconTrash } from '../../../icons';

export function FormatActions({ id, own, canEdit }: { id: string; own: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  if (!canEdit) return null;
  const dup = () => start(async () => { const r = await duplicateFormat(id); if (r.error) setErr(r.error); else router.push(`/admin/videos/formatos/${r.id}`); });
  const del = () => { if (!confirm('Excluir este formato? Os roteiros já gerados continuam existindo.')) return; start(async () => { const r = await deleteFormat(id); if (r.error) setErr(r.error); else router.refresh(); }); };
  return (
    <div className="vd-fmt-actions">
      {own && <Link href={`/admin/videos/formatos/${id}`} className="btn small"><IconEdit /> Editar</Link>}
      <button type="button" className="btn small" onClick={dup} disabled={pending}><IconCopy /> {own ? 'Duplicar' : 'Duplicar para editar'}</button>
      {own && <button type="button" className="btn small ghost danger" onClick={del} disabled={pending} aria-label="Excluir formato"><IconTrash /></button>}
      {err && <small className="vd-err">{err}</small>}
    </div>
  );
}
