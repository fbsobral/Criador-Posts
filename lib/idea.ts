/** Tipos e constantes das ideias de conteúdo (servidor e navegador). */

export type IdeaStatus = 'idea' | 'approved' | 'used';
export const IDEA_STATUS: { id: IdeaStatus; label: string }[] = [
  { id: 'idea', label: 'Ideia' },
  { id: 'approved', label: 'Aprovada' },
  { id: 'used', label: 'Já usada' },
];

export type Idea = {
  id: string; personaId: string | null; personaName: string; territoryId: string | null; territory: string;
  pain: string; guide: string; args: string[]; cta: string; status: IdeaStatus; source: string; createdAt: string;
};
/** O que o usuário preenche (ou a IA sugere) numa ideia. */
export type IdeaInput = { personaId: string | null; territoryId: string | null; territory: string; pain: string; guide: string; args: string[]; cta: string };

export const MAX_IDEAS_PER_RUN = 8;
export const ESTIMATED_COST_PER_IDEA = 0.012;
export const ESTIMATED_COST_IDEA_BASE = 0.01;

export const FIELD_HELP = {
  persona: 'Quem vai se reconhecer nesta ideia.',
  territory: 'O tema (do mapa de Territórios) de onde a ideia nasce. Pode ficar em branco.',
  pain: 'A dor, do jeito que a pessoa fala na rua, sem jargão e sem "marketês".',
  guide: 'O enquadramento (Lakoff): o valor e a imagem que guiam a conversa, sem repetir o discurso do outro lado nem se defender dele.',
  args: 'Os argumentos, já dentro do enquadramento: fatos e exemplos que sustentam o guia.',
  cta: 'A chamada indireta: um convite natural (olhar, perceber, conversar, compartilhar), sem vender.',
} as const;

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
