/** Tipos e constantes das ideias de conteúdo (servidor e navegador). */

export type IdeaStatus = 'idea' | 'approved' | 'used';
export const IDEA_STATUS: { id: IdeaStatus; label: string }[] = [
  { id: 'idea', label: 'Ideia' },
  { id: 'approved', label: 'Aprovada' },
  { id: 'used', label: 'Já usada' },
];

/** Os campos de texto de uma ideia, na ordem da narrativa: dor → impacto → causa → guia → plano → ganho → desejo → CTA. */
export type IdeaFields = { pain: string; impact: string; cause: string; guide: string; plan: string; gain: string; desire: string; cta: string };
export type Idea = IdeaFields & {
  id: string; personaId: string | null; personaName: string; territoryId: string | null; territory: string;
  status: IdeaStatus; source: string; createdAt: string;
};
/** O que o usuário preenche (ou a IA sugere) numa ideia. */
export type IdeaInput = IdeaFields & { personaId: string | null; territoryId: string | null; territory: string };

export const IDEA_FIELDS: { key: keyof IdeaFields; label: string; rows: number; max: number; placeholder: string; help: string }[] = [
  { key: 'pain', label: 'Dor (linguagem de rua)', rows: 3, max: 400, placeholder: '“Todo mês eu pago o aluguel e não sobra nada pra mim.”', help: 'Como a pessoa fala de boca, sem jargão e sem "marketês".' },
  { key: 'impact', label: 'Impacto', rows: 2, max: 400, placeholder: 'O que essa dor faz na vida dela: contas, saúde, família, tempo.', help: 'As consequências concretas da dor no dia a dia.' },
  { key: 'cause', label: 'Causa', rows: 2, max: 400, placeholder: 'Por que isso acontece (a causa coletiva, não a culpa da pessoa).', help: 'A raiz do problema, sem culpar quem sofre.' },
  { key: 'guide', label: 'Guia (enquadramento progressista)', rows: 3, max: 600, placeholder: 'Cuidado e proteção: uma cidade que cuida de quem mora nela, como uma casa onde todo mundo cabe.', help: 'Lakoff: o valor e a imagem que conduzem a conversa, sem repetir o discurso do outro lado nem se defender dele.' },
  { key: 'plan', label: 'Plano', rows: 3, max: 700, placeholder: 'O caminho em passos curtos: o que fazer e como a organização ajuda.', help: 'O que a pessoa pode fazer, em passos concretos.' },
  { key: 'gain', label: 'Ganho', rows: 2, max: 400, placeholder: 'O que muda na vida dela quando o plano funciona.', help: 'O resultado concreto e visível.' },
  { key: 'desire', label: 'Desejo', rows: 2, max: 400, placeholder: 'O que ela quer de verdade lá no fundo (segurança, dignidade, sossego).', help: 'A aspiração por trás da dor: o que quer ser ou sentir.' },
  { key: 'cta', label: 'CTA', rows: 2, max: 300, placeholder: 'O próximo passo: manda pra quem passa por isso.', help: 'O convite final, claro e natural.' },
];
export const EMPTY_FIELDS: IdeaFields = { pain: '', impact: '', cause: '', guide: '', plan: '', gain: '', desire: '', cta: '' };

export const MAX_IDEAS_PER_RUN = 8;
export const ESTIMATED_COST_PER_IDEA = 0.022;
export const ESTIMATED_COST_IDEA_BASE = 0.01;

import { buildTree, type TNode, type TreeItem } from './territory';

export type TerritoryOption = { id: string; personaId: string; label: string; path: string; depth: number };

/** Territórios de todos os mapas em ordem de árvore, com o caminho completo, para os seletores. */
export function territoryOptions(nodes: TNode[]): TerritoryOption[] {
  const out: TerritoryOption[] = [];
  const walk = (items: TreeItem<TNode>[], depth: number, path: string[]) => {
    for (const it of items) {
      const p = [...path, it.data.name];
      out.push({ id: it.id, personaId: it.data.personaId, label: it.data.name, path: p.join(' › '), depth });
      walk(it.children, depth + 1, p);
    }
  };
  const ids = [...new Set(nodes.map((n) => n.personaId))];
  for (const pid of ids) walk(buildTree(nodes.filter((n) => n.personaId === pid)), 0, []);
  return out;
}
