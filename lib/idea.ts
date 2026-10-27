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

const LABELS: [keyof IdeaFields, string][] = [['pain', 'Dor'], ['impact', 'Impacto'], ['cause', 'Causa'], ['guide', 'Guia (enquadramento)'], ['plan', 'Plano'], ['gain', 'Ganho'], ['desire', 'Desejo'], ['cta', 'CTA']];
const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

/** A ideia como texto de entrada para a IA (roteiro ou post): a história inteira, na ordem. */
export function ideaBrief(f: IdeaFields, persona: string, territory: string): string {
  return [`IDEIA DE CONTEÚDO para a persona: ${persona || 'público geral'}${territory ? ` (território: ${territory})` : ''}`, ...LABELS.filter(([k]) => f[k]).map(([k, l]) => `${l.toUpperCase()}: ${k === 'plan' ? lines(f[k]).join(' → ') : f[k]}`)].join('\n');
}
/** Orientação extra para a IA (roteiro ou post) respeitar a ideia: arco didático, linguagem da persona, guia como bússola, sem números inventados. */
export const IDEA_INSTRUCTIONS = `ESTE CONTEÚDO PARTE DE UMA IDEIA ESTRUTURADA. Siga estas regras:
1) COMEÇO, MEIO E FIM, DIDÁTICO. Começo: a cena/dor que a pessoa reconhece. Meio: EXPLIQUE, em ordem de causa e efeito e com palavras simples, por que isso acontece, e depois o que fazer, em passos curtos e concretos. Fim: o que ela ganha e o convite (CTA). Cada frase deve levar à seguinte ("porque", "por isso", "aí", "então"). Fale como para um amigo que não entende do assunto.
2) CONCRETO, NÃO ABSTRATO. Troque palavras abstratas (transparência, repasse, equidade, sistema) por ações e situações visíveis do dia a dia da pessoa. Se usar um termo difícil, explique logo em seguida com uma frase simples.
3) FALE COM A PERSONA: use o jeito de falar, os exemplos, o trabalho e as contas dela; se couber, responda à objeção dela.
4) O GUIA é bússola: use o valor para escolher o ponto de vista e as palavras, mas NÃO narre a metáfora do guia nem diga "valor" ou "enquadramento". Só use imagem se vier do universo da própria persona.
5) NÃO invente números, valores, datas nem fontes. Sem dado real na ideia, fale em termos qualitativos.
6) Não ataque pessoas nem grupos.
Se houver poucas partes ou slides, comprima, mas mantenha começo, meio e fim.`;
/** Resumo da ideia para o campo "Ideia" do roteiro: a causa e o caminho, em linguagem simples. */
export const ideaAngle = (f: IdeaFields) => [f.cause, f.plan ? `O que fazer: ${lines(f.plan).join('; ')}.` : ''].filter(Boolean).join(' ').slice(0, 500);
/** Título curto a partir da dor. */
export const ideaTitle = (pain: string) => { const t = pain.replace(/^["“”'\s]+|["“”'\s]+$/g, '').replace(/\s+/g, ' '); return t.length > 120 ? `${t.slice(0, 117)}…` : t; };
/** Pontos principais (os passos do plano, ou ganho e desejo) para o planejamento do roteiro. */
export const ideaPoints = (f: IdeaFields) => [...lines(f.plan), f.gain, f.desire].filter(Boolean).slice(0, 6);
