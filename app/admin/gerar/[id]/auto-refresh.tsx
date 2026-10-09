'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Atualiza a página enquanto há itens na fila e garante que o servidor esteja processando o lote. */
export function AutoRefresh({ batchId, active }: { batchId: string; active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    fetch('/api/ai/kick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId }) }).catch(() => {});
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, batchId, router]);
  return active ? <span className="pill draft live">● atualizando</span> : null;
}
