/** Mostra de qual organização (marca) são os dados da página: tudo aqui é só dela. */
export function OrgPill({ name }: { name: string }) {
  return <span className="org-pill" title="Todos os dados desta página são só desta organização">🏢 {name}</span>;
}
