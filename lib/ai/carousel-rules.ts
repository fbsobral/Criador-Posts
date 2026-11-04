/** Regras puras do carrossel (sem chamadas de IA): ângulos, craft, mapa ideia → slides, bloco do roteiro aprovado e revisão automática. Sem importar o gerador, para evitar ciclos. */

/* ---------------- ângulos narrativos ---------------- */
export type CarouselAngleId = 'auto' | 'crenca' | 'cena' | 'razoes' | 'mito' | 'espelho' | 'antes-depois';

export const CAROUSEL_ANGLES: { id: CarouselAngleId; label: string; hint: string; guide: string }[] = [
  { id: 'auto', label: 'A IA escolhe', hint: 'Escolhe o ângulo que melhor serve a esta ideia', guide: '' },
  { id: 'crenca', label: 'Quebra de crença', hint: '“Não é X. É Y.”', guide: 'QUEBRA DE CRENÇA ("Não é X. É Y."): a capa nega a explicação óbvia da dor e promete a verdadeira (ex.: "Ele não largou o estágio por preguiça."). Slide 2: a cena que a pessoa reconhece. Slide 3: a VIRADA, a causa coletiva como revelação ("o que faltou foi…"). Meio: os argumentos como PROVA, um por slide. Penúltimo: ganho e desejo. Último: a CTA.' },
  { id: 'cena', label: 'Em cena', hint: 'Uma pequena história', guide: 'EM CENA (história): conte uma pequena história HIPOTÉTICA em três tempos, com um personagem genérico ("imagina um jovem que…", sem nome real, sem números): a cena (a dor), o ponto de virada (a causa e o que mudou) e o depois (ganho e desejo). Os argumentos entram como o que fez diferença na história. Cada slide puxa o seguinte.' },
  { id: 'razoes', label: 'Lista de razões', hint: '“3 motivos pelos quais…”', guide: 'LISTA DE RAZÕES: a capa promete N razões ("3 motivos pelos quais…", N = o número de argumentos que você vai usar, de 2 a 4). O slide 2 abre com a dor. Cada argumento vira UM slide: título com a razão em até 8 palavras + 1 ou 2 frases com um exemplo concreto. Fecho com ganho e a CTA.' },
  { id: 'mito', label: 'Mito x verdade', hint: 'Desmontar uma crença comum', guide: 'MITO x VERDADE: a capa nomeia o mito comum sobre a dor. Slide 2: "o que dizem" x "o que acontece de verdade". A causa desmonta o mito; os argumentos sustentam a verdade, um por slide. Fecho com ganho e CTA.' },
  { id: 'espelho', label: 'Você se reconhece?', hint: 'Identificação direta', guide: 'VOCÊ SE RECONHECE?: a capa é uma pergunta direta à persona, a que ela já se faz. Slides 2 e 3 espelham situações dela (dor e impacto) em frases de identificação ("Se você já…"). Virada: "isso tem causa, e não é culpa sua". Os argumentos mostram a saída. Fecho: convite (CTA).' },
  { id: 'antes-depois', label: 'Antes e depois', hint: 'Contraste impacto x ganho', guide: 'ANTES E DEPOIS: a capa mostra o contraste. Slide "Antes": cenas concretas do impacto. Slide "Depois": o ganho e o desejo. Entre os dois, os argumentos como a ponte (por que dá para sair do antes). Fecho: a CTA.' },
];

export const isCarouselAngle = (v: unknown): v is CarouselAngleId => CAROUSEL_ANGLES.some((a) => a.id === v);

/* ---------------- regras de craft ---------------- */
/** Regras de um diretor de conteúdo sênior para o carrossel. Valem para toda geração de carrossel. */
export const CAROUSEL_CRAFT = `CRAFT DE CARROSSEL (siga como um diretor de conteúdo sênior)
CAPA (slide 1)
- A capa precisa parar o dedo no scroll: uma promessa específica, OU uma tensão/contradição, OU a pergunta que a persona já se faz. Título de até 10 palavras (de preferência 6 a 9), sem enfeite ("Descubra", "Você sabia?") e sem rótulo genérico ("Dicas sobre…").
- Abaixo do título, no máximo uma linha de apoio (até 14 palavras) que aumenta a curiosidade sem entregar a resposta.
- "cover_options": 3 alternativas de título de capa, com abordagens diferentes (uma tensão/contradição, uma pergunta, uma promessa), cada uma com até 10 palavras e diferentes do título que você usou.
SLIDES
- UMA ideia por slide. Texto curto: de 18 a 32 palavras (nunca mais de 40: a fonte é grande e ocupa a tela do celular). O título (<h2>) tem até 8 palavras e sozinho já conta o ponto.
- Frases curtas (até ~14 palavras). Em cada slide de texto, destaque com <b> a frase-chave (só uma).
- Cada slide, menos o último, deixa um GANCHO para o próximo ("mas tem um detalhe", "e aqui está o problema", uma pergunta aberta). Sem caça-clique: o slide seguinte entrega o que o anterior promete.
- Slide 2: identificação (a persona se reconhece). Penúltimo: o futuro (ganho e desejo, concretos). Último: a CTA com UMA única ação e o porquê.
- Ritmo: alterne formatos e densidade. Use "destaque" (uma frase de impacto, até 14 palavras, sem corpo) em 1 ou 2 momentos de virada; use "pergunta" para espelhar a persona; listas (check ou arrow) só para enumerar 3 itens curtos; nunca dois slides densos (mais de 28 palavras) em sequência.
- Nada de abstração: troque por cena, ação ou exemplo ("imagina um jovem que…", sem nomes reais, números nem datas inventados).
- Linguagem do dia a dia da persona (ou do público em geral). Sem jargão, sem clichês de IA e sem emojis, a menos que o tom da marca peça.`;

/** Quantos slides: a IA decide pelo conteúdo ou segue o número pedido. */
export const slidesRule = (n: number) => (n > 0 ? `Use ${n} slides (pode variar em 1).` : 'Escolha de 6 a 9 slides, o mínimo que conta bem a história (a lista de argumentos usados e o ângulo definem o número). Máximo 10.');

/** Como transformar os campos da ideia em slides (modo "ideia"). */
export const IDEA_TO_SLIDES = `COMO USAR A IDEIA NO CARROSSEL (a ideia vem estruturada; NÃO copie os campos, TRADUZA cada um em slides com função)
- DOR → a capa (tensão ou contradição) e o slide de identificação.
- IMPACTO → o que está em jogo; faz a pessoa sentir o custo.
- CAUSA → a virada: "o que ninguém conta", sempre coletiva, nunca culpa da pessoa.
- GUIA → bússola de valores: escolhe o ponto de vista e as palavras. NÃO narre a metáfora do guia nem diga "valor" ou "enquadramento".
- ARGUMENTOS → a prova. São razões independentes, não um passo a passo: use de 1 a 3 dos mais fortes (não precisa de todos), cada um desenvolvido com uma cena ou exemplo concreto.
- GANHO e DESEJO → o futuro (o que melhora na prática e como a pessoa se sente).
- CTA → o fecho, mantendo a ação da ideia e ajustando a mecânica ao formato carrossel (salvar, mandar para alguém, comentar, seguir, falar com a organização). Só convide para o que a organização realmente faz.
- Sem persona definida, a dor é uma afirmação sobre o tema (não uma fala em primeira pessoa); mantenha tudo impessoal.`;


/** Bloco do roteiro aprovado, para a escrita seguir fielmente. */
export function planBlock(p: { angle?: string; promise?: string; slides: { role: string; message: string }[] }): string {
  return `ROTEIRO DOS SLIDES APROVADO PELO USUÁRIO (siga a ordem, a função e a mensagem de cada slide; você pode lapidar as palavras, nunca mudar o sentido nem a sequência)\n${p.promise ? `Promessa: ${p.promise}\n` : ''}${p.slides.map((s, i) => `${i + 1}. ${s.role ? `[${s.role}] ` : ''}${s.message}`).join('\n')}`;
}


/* ---------------- revisão automática ---------------- */
export type ReviewItem = { ok: boolean; label: string; detail: string; slides: number[] };

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (t: string) => (t ? t.split(/\s+/).filter(Boolean).length : 0);
const ACTION = /\b(salv\w+|compartilh\w+|mand\w+|envi\w+|coment\w+|segu\w+|acess\w+|conhe[cç]\w+|clique\w*|fale\w*|chame\w*|inscrev\w+|doe\w*|apoi\w+|particip\w+|baix\w+|marque\w*|link|bio|responda\w*|conte\w*)\b/i;

/** Checagem de craft do carrossel (a mesma lógica roda no editor). */
export function reviewCarousel(slides: { format?: string; html?: string }[]): ReviewItem[] {
  const texts = slides.map((s) => plain(String(s.html ?? '')));
  const wc = texts.map(words);
  const coverTitle = plain((String(slides[0]?.html ?? '').match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]) ?? '');
  const over = wc.map((w, i) => (w > 40 && slides[i]?.format !== 'image' ? i : -1)).filter((i) => i >= 0);
  const dense = wc.map((w, i) => (i > 0 && w > 28 && wc[i - 1] > 28 ? i : -1)).filter((i) => i >= 0);
  const last = texts[texts.length - 1] ?? '';
  return [
    { ok: !!coverTitle && words(coverTitle) <= 12, label: 'Capa curta e forte', detail: coverTitle ? `${words(coverTitle)} palavras no título (ideal: até 10)` : 'A capa não tem título', slides: [0] },
    { ok: over.length === 0, label: 'Texto enxuto em cada slide', detail: over.length ? `Passa de 40 palavras: slide${over.length > 1 ? 's' : ''} ${over.map((i) => i + 1).join(', ')}` : 'Nenhum slide passa de 40 palavras', slides: over },
    { ok: dense.length === 0, label: 'Ritmo (sem slides densos em sequência)', detail: dense.length ? `Slides ${dense.map((i) => `${i}–${i + 1}`).join(', ')} seguidos e densos` : 'Alterna bem a densidade', slides: dense },
    { ok: slides.length >= 5 && slides.length <= 10, label: 'Quantidade de slides', detail: `${slides.length} slides (ideal: de 6 a 9)`, slides: [] },
    { ok: ACTION.test(last), label: 'Fechamento com uma ação', detail: ACTION.test(last) ? 'O último slide convida a uma ação' : 'O último slide não parece pedir uma ação', slides: [slides.length - 1] },
  ];
}
