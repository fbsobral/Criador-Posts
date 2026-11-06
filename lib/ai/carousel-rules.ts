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
- A capa para o dedo no scroll porque é ESPECÍFICA: usa um elemento concreto que só ESTA ideia tem (a contradição, o custo, a cena, o momento exato). Teste: se o título servir para qualquer outro post sobre o mesmo tema, reescreva.
  Bom: "Dois anos de experiência para o primeiro emprego" (contradição concreta). Bom: "Ele largou o estágio depois da primeira bronca" (cena). Ruim: "Por que tantos jovens largam o estágio?" (genérico). Ruim: "O primeiro emprego pode ser diferente" (vago).
- Título de até 10 palavras (6 a 9 é o ideal). Proibido na capa e na linha de apoio: "A resposta não é a que todo mundo imagina", "Você sabia?", "Descubra", "O que ninguém conta" e qualquer frase que só anuncia que há uma resposta. A linha de apoio (até 14 palavras) ACRESCENTA um fato da ideia, um custo ou o ângulo, em vez de provocar.
- "cover_options": 3 alternativas de título de capa com abordagens diferentes (tensão/contradição, pergunta que a pessoa já se faz, promessa concreta), cada uma com até 10 palavras, específicas pelo mesmo teste, e diferentes do título que você usou.
ESTRUTURA (o carrossel é uma HISTÓRIA com argumento, não uma lista de dicas)
- Arco: cena de identificação → o custo → a causa (coletiva, sem culpar a pessoa) → a virada (a nova forma de ver) → o que muda na prática, com um exemplo concreto → o resultado → a ação. Cada slide responde a uma pergunta que o anterior deixou no ar.
- Prova: no máximo 2 ou 3 slides de argumento, cada um mostrando o que ACONTECE (quem faz o quê e o que muda), ligado à causa, em até ~22 palavras (2 ou 3 frases curtas; são eles que costumam ficar densos lado a lado). Proibido virar sequência de dicas: título de argumento NÃO começa com verbo no imperativo ou infinitivo ("Comece cedo", "Conecte-se", "Acompanhar…") e não há "Dica 1, 2, 3". Ruim: "Comece cedo: encontros práticos no ensino médio". Bom: "Quem treinou a reunião antes não trava na primeira".
- Fale com quem a ideia quer mover: com persona definida, é ela (segunda pessoa, no jeito dela); sem persona ("Público geral"), a cena é contada em terceira pessoa ("um jovem que…") e os slides finais falam diretamente com quem a CTA da ideia convoca (uma empresa, um mentor, um doador, um jovem).
SLIDES
- UMA ideia por slide. Texto curto: de 15 a 28 palavras contando o título (nunca mais de 35: a fonte é grande e ocupa a tela do celular). O título (<h2>) tem até 8 palavras e já conta o ponto, com conteúdo (nada de rótulo como "O problema" ou "A solução").
- O corpo PROVA o título: se o título diz "Quem treinou a reunião antes não trava", o corpo mostra essa pessoa na reunião, não uma lista de recursos. Lista só quando o título anuncia itens ("Três perguntas que travam o primeiro dia").
- Frases curtas (até ~14 palavras). Em cada slide de texto, destaque com <b> a frase-chave (só uma).
- GANCHO: o que faz a pessoa virar o slide é o CONTEÚDO. Termine cada slide com a frase que fecha a ideia dele, de preferência a mais forte ou a mais concreta. O próximo título avança a história. Ex. bom: slide termina em "Ninguém tinha ensinado ele a pedir ajuda." e o próximo título é "A escola ensina matéria, não reunião". É PROIBIDO usar frases de tease vazias: "E aí tudo muda", "E ainda tem outro detalhe", "Mas tem um detalhe", "E aqui está o problema", "Mas e…?", "Parece X. Não é.", "Spoiler:", "Mas tem mais" e variações. Sem gancho é melhor do que gancho vazio.
- Nada se repete: cada slide traz uma informação nova. O slide 2 não repete a capa (a capa promete; o slide 2 abre a cena com um detalhe que a capa não tinha). Cada fato e cada cena aparecem uma vez; a cena do começo só volta no futuro, para fechar o arco mostrando o que mudou.
- Slide 2: identificação (a pessoa se reconhece numa cena concreta: onde, quando, o que ela ouve ou faz). Penúltimo: o futuro (ganho e desejo, concretos). Último: a CTA (regra abaixo).
- CTA: o último slide é a ação da "CTA da ideia", com o MESMO destinatário e a MESMA ação (pode encurtar e dizer o porquê). UMA ação só: não some "mande para alguém" com "fale com a gente" no mesmo slide. Se ela convoca empresas, o slide fala com empresas. A CTA padrão da marca só entra quando não há CTA da ideia. Proibido trocar por CTA genérica ("Siga a página", "Siga para mais", "Você vive esse desafio?", "Comente aqui") que a ideia não pediu.
- Ritmo: alterne formatos e densidade. Planeje isso na estrutura (cada linha termina com "leve" ou "denso"). Denso = parágrafo com mais de ~25 palavras. Um slide "text" tem o título e NO MÁXIMO 2 frases curtas de corpo, sendo uma delas a frase em <b> (três frases já é denso). NUNCA dois densos seguidos: depois de um denso vem um leve ("destaque", "pergunta", lista de 3 itens curtos ou texto de até 20 palavras). Em carrosséis de 6 slides ou mais, é OBRIGATÓRIO ter pelo menos um "destaque" (na virada) E pelo menos um "pergunta" (para quem lê se ver na história), além de "text"; isso vale também para tema e material. Confira na estrutura antes de escrever. Nunca três "text" seguidos. O trecho final é onde o ritmo costuma morrer (prova, prova, futuro, CTA, todos em parágrafo): faça o futuro como "destaque" (uma frase concreta do que muda) e a CTA com até 25 palavras.
- Nada de abstração: troque por cena, ação ou exemplo ("imagina um jovem que…", sem nomes reais, números nem datas inventados). Verbos vagos (aproximar, acompanhar, fortalecer, conectar, engajar, transformar) só com o que acontece de verdade logo em seguida.
- Linguagem do dia a dia da persona (ou do público em geral), na voz da marca. Sem jargão, sem clichês de IA, sem sermão e sem emojis, a menos que o tom da marca peça.`;

/** Quantos slides: a IA decide pelo conteúdo ou segue o número pedido. */
export const slidesRule = (n: number) => (n > 0 ? `Use ${n} slides (pode variar em 1).` : 'Escolha de 6 a 9 slides, o mínimo que conta bem a história (a lista de argumentos usados e o ângulo definem o número). Máximo 10.');

/** Como transformar os campos da ideia em slides (modo "ideia"). */
export const IDEA_TO_SLIDES = `COMO USAR A IDEIA NO CARROSSEL (a ideia vem estruturada; NÃO copie os campos, TRADUZA cada um em slides com função)
- DOR → a capa (tensão ou contradição) e o slide de identificação.
- IMPACTO → o que está em jogo; faz a pessoa sentir o custo.
- CAUSA → a virada: a causa por trás do problema, sempre coletiva, nunca culpa da pessoa.
- GUIA → bússola de valores: escolhe o ponto de vista e as palavras. NÃO narre a metáfora do guia nem diga "valor" ou "enquadramento".
- ARGUMENTOS → a prova. São razões independentes, não um passo a passo: use de 1 a 3 dos mais fortes (não precisa de todos), cada um desenvolvido com uma cena ou exemplo concreto.
- GANHO e DESEJO → o futuro (o que melhora na prática e como a pessoa se sente).
- CTA → o último slide e o fecho da legenda: a MESMA ação e o MESMO destinatário da CTA da ideia (ela tem prioridade sobre a CTA padrão da marca). Você só adapta a forma ao carrossel (ex.: "chame a gente no direct", "mande este post para…"). Só convide para o que a organização realmente faz.
- Sem persona definida, não escreva a dor como fala em primeira pessoa: conte a cena em terceira pessoa ("um jovem que…", "a empresa que…") e, no fim, fale direto com quem a CTA convoca.`;


/** Bloco do roteiro aprovado, para a escrita seguir fielmente. */
export function planBlock(p: { angle?: string; promise?: string; slides: { role: string; message: string }[] }): string {
  return `ROTEIRO DOS SLIDES APROVADO PELO USUÁRIO (siga a ordem, a função e a mensagem de cada slide; você pode lapidar as palavras, nunca mudar o sentido nem a sequência)\n${p.promise ? `Promessa: ${p.promise}\n` : ''}${p.slides.map((s, i) => `${i + 1}. ${s.role ? `[${s.role}] ` : ''}${s.message}`).join('\n')}`;
}


/* ---------------- revisão automática ---------------- */
export type ReviewItem = { ok: boolean; label: string; detail: string; slides: number[] };

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (t: string) => (t ? t.split(/\s+/).filter(Boolean).length : 0);
const ACTION = /\b(salv\w+|compartilh\w+|mand\w+|envi\w+|coment\w+|segu\w+|acess\w+|conhe[cç]\w+|clique\w*|fale\w*|chame\w*|convers\w+|escrev\w+|mensagem|inscrev\w+|doe\w*|apoi\w+|particip\w+|baix\w+|marque\w*|link|bio|responda\w*|conte\w*)\b/i;

const TEASE = /(e a[ií] tudo muda|outro detalhe|tem um detalhe|aqui est[aá] o problema|n[aã]o [eé] a que todo mundo|voc[eê] sabia|descubra|parece \w+\.\s*n[aã]o [eé]\b)/i;

/** Checagem de craft do carrossel (a mesma lógica roda no editor). */
export function reviewCarousel(slides: { format?: string; html?: string }[]): ReviewItem[] {
  const texts = slides.map((s) => plain(String(s.html ?? '')));
  const wc = texts.map(words);
  const coverTitle = plain((String(slides[0]?.html ?? '').match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]) ?? '');
  const over = wc.map((w, i) => (w > 40 && slides[i]?.format !== 'image' ? i : -1)).filter((i) => i >= 0);
  const dense = wc.map((w, i) => (i > 0 && w > 28 && wc[i - 1] > 28 ? i : -1)).filter((i) => i >= 0);
  const last = texts[texts.length - 1] ?? '';
  const teases = texts.map((t, i) => (TEASE.test(t) ? i : -1)).filter((i) => i >= 0);
  return [
    { ok: !!coverTitle && words(coverTitle) <= 12, label: 'Capa curta e forte', detail: coverTitle ? `${words(coverTitle)} palavras no título (ideal: até 10)` : 'A capa não tem título', slides: [0] },
    { ok: over.length === 0, label: 'Texto enxuto em cada slide', detail: over.length ? `Passa de 40 palavras: slide${over.length > 1 ? 's' : ''} ${over.map((i) => i + 1).join(', ')}` : 'Nenhum slide passa de 40 palavras', slides: over },
    { ok: dense.length === 0, label: 'Ritmo (sem slides densos em sequência)', detail: dense.length ? `Slides ${dense.map((i) => `${i}–${i + 1}`).join(', ')} seguidos e densos` : 'Alterna bem a densidade', slides: dense },
    { ok: slides.length >= 5 && slides.length <= 10, label: 'Quantidade de slides', detail: `${slides.length} slides (ideal: de 6 a 9)`, slides: [] },
    { ok: teases.length === 0, label: 'Ganchos com conteúdo', detail: teases.length ? `Frase de tease vazia: slide${teases.length > 1 ? 's' : ''} ${teases.map((i) => i + 1).join(', ')}` : 'Sem ganchos vazios', slides: teases },
    { ok: ACTION.test(last), label: 'Fechamento com uma ação', detail: ACTION.test(last) ? 'O último slide convida a uma ação' : 'O último slide não parece pedir uma ação', slides: [slides.length - 1] },
  ];
}
