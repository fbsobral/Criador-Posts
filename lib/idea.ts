/** Tipos e constantes das ideias de conteúdo (servidor e navegador). */

export type IdeaStatus = 'idea' | 'approved' | 'used';
export const IDEA_STATUS: { id: IdeaStatus; label: string; color: string; hint: string }[] = [
  { id: 'idea', label: 'Ideia', color: '#8A857A', hint: 'Solte uma ideia aqui' },
  { id: 'approved', label: 'Aprovada', color: '#1F9D63', hint: 'Solte aqui o que foi aprovado' },
  { id: 'used', label: 'Já usada', color: '#1D9BF0', hint: 'Solte aqui o que já virou conteúdo' },
];

/** Os campos de texto de uma ideia, na ordem da narrativa: dor → impacto → causa → guia → argumentos → ganho → desejo → CTA. */
export type IdeaFields = { pain: string; impact: string; cause: string; guide: string; args: string; gain: string; desire: string; cta: string };
export type Idea = IdeaFields & {
  id: string; personaId: string | null; personaName: string; territoryId: string | null; territory: string;
  status: IdeaStatus; source: string; createdAt: string;
};
/** O que o usuário preenche (ou a IA sugere) numa ideia. */
export type IdeaInput = IdeaFields & { personaId: string | null; territoryId: string | null; territory: string };

export const IDEA_FIELDS: { key: keyof IdeaFields; label: string; rows: number; max: number; placeholder: string; help: string }[] = [
  { key: 'pain', label: 'Dor (linguagem de rua)', rows: 3, max: 400, placeholder: '“Todo mês eu pago o aluguel e não sobra nada pra mim.”', help: 'Como a pessoa fala de boca, sem jargão e sem "marketês". Sem persona: uma afirmação sobre o fato ou o território, nunca uma fala em primeira pessoa.' },
  { key: 'impact', label: 'Impacto', rows: 2, max: 400, placeholder: 'O que essa dor faz na vida dela: contas, saúde, família, tempo.', help: 'As consequências concretas da dor no dia a dia.' },
  { key: 'cause', label: 'Causa', rows: 2, max: 400, placeholder: 'Por que isso acontece (a causa coletiva, não a culpa da pessoa).', help: 'A raiz do problema, sem culpar quem sofre.' },
  { key: 'guide', label: 'Guia (enquadramento progressista)', rows: 3, max: 600, placeholder: 'Cuidado e proteção: uma cidade que cuida de quem mora nela, como uma casa onde todo mundo cabe.', help: 'Lakoff: o valor e a imagem que conduzem a conversa, sem repetir o discurso do outro lado nem se defender dele.' },
  { key: 'args', label: 'Argumentos (o que sustenta a solução)', rows: 4, max: 700, placeholder: 'Um argumento por linha. Ex.: quem treina a entrevista antes chega ao primeiro estágio mais seguro.', help: 'Razões que sustentam a solução da dor, um por linha. São itens para considerar ao montar o roteiro ou o post, não um passo a passo.' },
  { key: 'gain', label: 'Ganho', rows: 2, max: 400, placeholder: 'O resultado prático da dor resolvida, o oposto do impacto (ex.: sobra dinheiro no fim do mês).', help: 'O resultado racional, concreto e visível: normalmente o oposto do impacto.' },
  { key: 'desire', label: 'Desejo', rows: 2, max: 400, placeholder: 'Como ela se sente com a dor resolvida (tranquila, respeitada, segura, livre).', help: 'O resultado emocional: o sentimento de ter a dor resolvida.' },
  { key: 'cta', label: 'CTA', rows: 2, max: 300, placeholder: 'O próximo passo: manda pra quem passa por isso.', help: 'O convite final, claro e natural.' },
];
export const EMPTY_FIELDS: IdeaFields = { pain: '', impact: '', cause: '', guide: '', args: '', gain: '', desire: '', cta: '' };

/** O que a ideia quer provocar na pessoa. "auto" = a IA escolhe, ideia por ideia. */
export type IdeaObjective = 'auto' | 'conscientizar' | 'engajar' | 'aproximar' | 'apoiar' | 'participar';
export const IDEA_OBJECTIVES: { id: IdeaObjective; label: string; hint: string; /** explicação curta para quem escolhe (tela) */ desc: string; /** instrução para a IA */ guide: string }[] = [
  { id: 'auto', label: 'A IA escolhe', hint: 'Escolhe o melhor para cada ideia', desc: 'Decide ideia por ideia, pelo momento do público e pelo tema. Bom para gerar um lote variado.', guide: '' },
  { id: 'conscientizar', label: 'Conscientizar', hint: 'Fazer perceber o problema', desc: 'Para quem ainda não vê o problema. Explica a causa e pede um passo leve: salvar ou mandar para quem precisa saber.', guide: 'CONSCIENTIZAR: fazer a pessoa perceber e entender o problema e a causa coletiva. A CTA pede um passo leve de atenção: salvar, mandar para quem precisa saber. Nada de "siga a página".' },
  { id: 'engajar', label: 'Engajar', hint: 'Abrir conversa', desc: 'Puxa conversa. Pede uma resposta fácil: contar a própria experiência, responder uma pergunta, marcar alguém.', guide: 'ENGAJAR: abrir conversa. A CTA pede uma resposta fácil: contar a própria experiência, comentar, responder uma pergunta, mandar para alguém que vive isso.' },
  { id: 'aproximar', label: 'Aproximar', hint: 'Captar contato', desc: 'Primeiro contato com a organização, sem compromisso: chamar para conversar, deixar o contato, conhecer o programa.', guide: 'APROXIMAR (captar contato): trazer a pessoa para perto da organização. A CTA pede um primeiro contato de baixo esforço: deixar o contato, entrar na lista de novidades, chamar para conversar, conhecer o programa.' },
  { id: 'apoiar', label: 'Apoiar', hint: 'Doar ou patrocinar', desc: 'Pede contribuição com recurso: doar, patrocinar ou apoiar um projeto, mostrando por que isso importa.', guide: 'APOIAR (doar/patrocinar): levar a pessoa ou a empresa a contribuir. A CTA pede um gesto concreto de apoio (doar, patrocinar, apoiar um projeto), com a razão de por que isso importa, sem pressão de venda.' },
  { id: 'participar', label: 'Participar', hint: 'Voluntariar-se ou se inscrever', desc: 'O maior compromisso: entrar e fazer junto. Ser voluntário ou mentor, se inscrever, ir a uma atividade.', guide: 'PARTICIPAR: levar a pessoa a agir junto. A CTA convida a se inscrever, se voluntariar, ser mentor, comparecer a uma atividade ou se candidatar a um programa.' },
];

export const MAX_IDEAS_PER_RUN = 8;
export const ESTIMATED_COST_PER_IDEA = 0.022;
export const ESTIMATED_COST_IDEA_BASE = 0.01;

import { buildTree, effectivePersonas, translationFor, type TNode, type TreeItem } from './territory';

/** `personaIds`: quem enxerga o território (ligação própria ou herdada); `translated`: quem já tem a tradução do tema. */
export type TerritoryOption = { id: string; label: string; path: string; depth: number; personaIds: string[]; translated: string[] };

/** Territórios do mapa da marca em ordem de árvore, com o caminho completo, para os seletores. */
export function territoryOptions(nodes: TNode[]): TerritoryOption[] {
  const out: TerritoryOption[] = [];
  const walk = (items: TreeItem<TNode>[], depth: number, path: string[]) => {
    for (const it of items) {
      const p = [...path, it.data.name];
      out.push({ id: it.id, label: it.data.name, path: p.join(' › '), depth, personaIds: effectivePersonas(nodes, it.id), translated: effectivePersonas(nodes, it.id).filter((pid) => translationFor(nodes, it.id, pid).text) });
      walk(it.children, depth + 1, p);
    }
  };
  walk(buildTree(nodes), 0, []);
  return out;
}

const LABELS: [keyof IdeaFields, string][] = [['pain', 'Dor'], ['impact', 'Impacto'], ['cause', 'Causa'], ['guide', 'Guia (enquadramento)'], ['args', 'Argumentos'], ['gain', 'Ganho'], ['desire', 'Desejo'], ['cta', 'CTA']];
const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

/** A ideia como texto de entrada para a IA (roteiro ou post): a história inteira, na ordem. */
export function ideaBrief(f: IdeaFields, persona: string, territory: string): string {
  return [`IDEIA DE CONTEÚDO para a persona: ${persona || 'público geral'}${territory ? ` (território: ${territory})` : ''}`, ...LABELS.filter(([k]) => f[k]).map(([k, l]) => `${l.toUpperCase()}: ${k === 'args' ? `${lines(f[k]).join(' | ')} (argumentos que sustentam a solução, não um passo a passo: use os mais fortes, desenvolvidos com uma situação concreta; não precisa de todos)` : f[k]}`)].join('\n');
}
/** Orientação extra para a IA (roteiro ou post) respeitar a ideia: arco didático, linguagem da persona, guia como bússola, sem números inventados. */
export const IDEA_INSTRUCTIONS = `ESTE CONTEÚDO PARTE DE UMA IDEIA ESTRUTURADA. Siga estas regras:
1) COMEÇO, MEIO E FIM, DIDÁTICO. Começo: a cena/dor que a pessoa reconhece. Meio: EXPLIQUE, em ordem de causa e efeito e com palavras simples, por que isso acontece, e depois mostre por que a solução funciona usando os ARGUMENTOS da ideia. Os argumentos NÃO são um passo a passo: são razões que sustentam a solução. Escolha o argumento (ou no máximo dois ou três) mais forte e mais fácil de entender e DESENVOLVA-O ligado à causa, com uma situação do dia a dia (quem faz o quê e o que muda), sem enumerar todos em sequência nem usar verbos vagos (aproximar, acompanhar, fortalecer) sem dizer o que acontece de verdade. Fim: o ganho racional (o oposto do impacto: o que melhora na prática), o desejo (o sentimento de ter a dor resolvida) e o convite (CTA). Cada frase deve levar à seguinte ("porque", "por isso", "aí", "então"). Fale como para um amigo que não entende do assunto.
2) CONCRETO, NÃO ABSTRATO. Troque palavras abstratas (transparência, repasse, equidade, sistema) por ações e situações visíveis do dia a dia da pessoa. Se usar um termo difícil, explique logo em seguida com uma frase simples.
3) FALE COM A PERSONA: use o jeito de falar, os exemplos, o trabalho e as contas dela; se couber, responda à objeção dela.
4) O GUIA é bússola: use o valor para escolher o ponto de vista e as palavras, mas NÃO narre a metáfora do guia nem diga "valor" ou "enquadramento". Só use imagem se vier do universo da própria persona.
5) NÃO invente números, valores, datas nem fontes. Sem dado real na ideia, fale em termos qualitativos.
6) Não ataque pessoas nem grupos.
Se houver poucas partes ou slides, comprima, mas mantenha começo, meio e fim.`;
/** Resumo da ideia para o campo "Ideia" do roteiro: a causa e o caminho, em linguagem simples. */
export const ideaAngle = (f: IdeaFields) => [f.cause, f.args ? `Argumentos que sustentam a solução (use os mais fortes, não todos): ${lines(f.args).join('; ')}.` : ''].filter(Boolean).join(' ').slice(0, 500);
/** Título curto a partir da dor. */
export const ideaTitle = (pain: string) => { const t = pain.replace(/^["“”'\s]+|["“”'\s]+$/g, '').replace(/\s+/g, ' '); return t.length > 120 ? `${t.slice(0, 117)}…` : t; };
/** Pontos principais (os argumentos, o ganho e o desejo) para o planejamento do roteiro. */
export const ideaPoints = (f: IdeaFields) => [...lines(f.args).slice(0, 4).map((a) => `Argumento: ${a}`), f.gain, f.desire].filter(Boolean).slice(0, 6);
