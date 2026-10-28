'use client';

import { useOrganization } from '@clerk/nextjs';
import { useEffect } from 'react';

/**
 * Trava de segurança: se a organização ativa no navegador (Clerk) for diferente da que o servidor usou para montar
 * a página (por exemplo, logo depois de trocar de organização), recarrega a página para nunca mostrar dados de outra marca.
 */
export function OrgSync({ serverOrgId }: { serverOrgId: string }) {
  const { organization, isLoaded } = useOrganization();
  useEffect(() => {
    if (!isLoaded || !organization || organization.id === serverOrgId) return;
    try {
      const n = Number(sessionStorage.getItem('org-sync-reloads') ?? 0);
      if (n >= 2) return; // evita laço de recarregamentos se o token demorar a atualizar
      sessionStorage.setItem('org-sync-reloads', String(n + 1));
    } catch { /* sem sessionStorage */ }
    window.location.reload();
  }, [isLoaded, organization, serverOrgId]);
  useEffect(() => { if (organization?.id === serverOrgId) { try { sessionStorage.removeItem('org-sync-reloads'); } catch { /* ok */ } } }, [organization, serverOrgId]);
  return null;
}
