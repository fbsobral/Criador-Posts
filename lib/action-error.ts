/** Mensagem amigável para uma ação do servidor que falhou. Depois de um deploy, uma página aberta fica com a versão antiga e a ação "não existe" mais. */
export function actionErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (/Server Action|was not found on the server/i.test(m)) return 'O app foi atualizado enquanto esta página estava aberta, e a ação não foi feita. Recarregue a página (Cmd/Ctrl + Shift + R) e tente de novo.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com o servidor. Nada foi alterado; tente de novo.';
  return 'Não foi possível concluir a ação. Nada foi alterado; recarregue a página e tente de novo.';
}
