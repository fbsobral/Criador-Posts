'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteArticle, duplicateArticle } from '@/lib/substack-actions';
import { IconCopy, IconTrash } from '../../icons';

export function ArticleMenu({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <div className="sb-item-act">
      <button type="button" className="btn small ghost" disabled={pending} title="Duplicar" aria-label="Duplicar artigo" onClick={() => start(async () => { const r = await duplicateArticle(id); if (r.error) setErr(r.error); else router.refresh(); })}><IconCopy /></button>
      <button type="button" className="btn small ghost danger" disabled={pending} title="Excluir" aria-label="Excluir artigo" onClick={() => { if (confirm('Excluir este artigo? Isso não pode ser desfeito.')) start(async () => { const r = await deleteArticle(id); if (r.error) setErr(r.error); else router.refresh(); }); }}><IconTrash /></button>
      {err && <small className="vd-err">{err}</small>}
    </div>
  );
}
