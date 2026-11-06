/**
 * Avaliação da qualidade da IA com chamadas REAIS (gasta créditos da API).
 * Gera carrossel, roteiro de vídeo e artigo a partir de ideias de exemplo, mostra o resultado
 * e aplica checagens automáticas de craft. Serve para afinar os prompts em ciclos: rodar, ler, ajustar, rodar de novo.
 *
 *   ANTHROPIC_API_KEY=... (ou EVAL_ANTHROPIC_API_KEY=...) npx tsx scripts/eval-ai.ts [carrossel|video|artigo|all] [--case N]
 *
 * Os casos cobrem ideia sem persona, ideia com persona jovem, ideia com persona de empresa (RH), tema livre e material colado,
 * e o roteiro alterna entre um formato de 3 partes e outro de 5. As entradas imitam o que o app envia.
 *
 * Os resultados ficam em eval-out/<alvo>-<caso>.md (fora do git).
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { generatePost } from '../lib/ai/generate';
import type { BrandProfile } from '../lib/ai/generate';
import { generateVideoScript } from '../lib/ai/video';
import { writeArticle } from '../lib/ai/substack';
import { ideaBlockFor } from '../lib/ai/carousel';
import { reviewCarousel } from '../lib/ai/carousel-rules';
import { personaBlock } from '../lib/ai/idea';
import { costUsd } from '../lib/ai/constants';
import { countWords, plainText, reviewArticle } from '../lib/substack';
import { allocate, wordsFor } from '../lib/video';
import { IDEA_INSTRUCTIONS, ideaAngle, ideaBrief, ideaPoints, ideaTitle, type IdeaFields } from '../lib/idea';
import type { PersonaData } from '../lib/persona';

// Em sessões do Claude Code, ANTHROPIC_API_KEY é retirada dos comandos (é o nome que o próprio Claude Code usa).
// Para testar, salve a chave do app como EVAL_ANTHROPIC_API_KEY. Ela vira a chave do SDK aqui, e o
// ANTHROPIC_BASE_URL da sessão é ignorado, para as chamadas irem direto à API com a chave do app.
if (process.env.EVAL_ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.EVAL_ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
}

const brand: BrandProfile = {
  brandName: 'D.C.T-Youths', niche: 'Mentoria e primeiro emprego para jovens de bairros com poucas oportunidades', audience: 'Jovens de 16 a 24 anos, empresas parceiras e mentores voluntários',
  voice: 'Próxima, direta e esperançosa. Fala como quem conversa com um amigo. Sem jargão, sem sermão.', rules: 'Nunca culpar o jovem. Não inventar números. Mostrar a causa coletiva e a solução prática.',
  cta: 'Convidar a agir de forma simples (mandar para alguém, falar com a organização).', examples: '', captionRules: '', about: 'Organização que prepara jovens para o primeiro emprego com treino, mentoria e parceria com empresas.',
};

type Persona = { name: string; tagline: string; role: string; data: PersonaData };
type VideoFormat = { name: string; parts: { id: string; name: string; instruction: string; percent: number }[] };
/** kind: de onde o conteúdo parte, como no app (ideia de conteúdo, tema livre ou material colado). */
type Case = { name: string; kind: 'ideia' | 'tema' | 'material'; persona: Persona | null; territory: string; idea?: IdeaFields; text?: string; videoFormat: 'curto' | 'longo'; seconds: number };

const SHELTON: Persona = {
  name: 'Shelton', tagline: 'Recém-formado que manda currículo todo dia e ouve que falta experiência', role: 'Jovem em busca do primeiro emprego',
  data: {
    age: '24', role: 'Recém-formado em administração, procurando o primeiro emprego', location: 'Periferia de uma capital',
    bio: 'Primeiro da família a terminar a faculdade. Mora com a mãe e dois irmãos, faz bico de entregador nos fins de semana e passa as manhãs mandando currículo pelo celular.',
    goals: ['Conseguir a primeira vaga na área', 'Ajudar nas contas de casa', 'Provar para si mesmo que o diploma valeu'],
    pains: ['Toda vaga pede experiência', 'Currículo sem resposta', 'Vergonha de contar que ainda não conseguiu'],
    objections: ['Mentoria é coisa de quem já tem contato', 'Não tenho tempo, preciso de renda agora'],
    triggers: ['Histórias de quem saiu do mesmo lugar', 'Algo prático que dá para fazer amanhã'],
    channels: ['Instagram', 'TikTok', 'grupos de vagas no WhatsApp'], quote: 'Como eu vou ter experiência se ninguém me dá a primeira chance?',
  },
};

const SHORT: VideoFormat = { name: 'Gancho + virada + CTA', parts: [{ id: 'p1', name: 'Gancho', instruction: 'Pare o scroll nos primeiros 3 segundos com uma cena ou contradição específica. Sem apresentação.', percent: 20 }, { id: 'p2', name: 'Virada e prova', instruction: 'Explique a causa em linguagem simples e mostre, com uma situação concreta, o que muda.', percent: 55 }, { id: 'p3', name: 'CTA', instruction: 'Uma única ação clara, dita de forma natural.', percent: 25 }] };
const LONG: VideoFormat = { name: 'História em 5 tempos', parts: [
  { id: 'p1', name: 'Gancho', instruction: 'Uma frase que pare o scroll: a cena ou a contradição. Sem "oi, gente".', percent: 12 },
  { id: 'p2', name: 'Contexto', instruction: 'Quem passa por isso e o que custa, em uma cena.', percent: 20 },
  { id: 'p3', name: 'Virada', instruction: 'A causa de verdade, explicada como para um amigo.', percent: 25 },
  { id: 'p4', name: 'Prova', instruction: 'Uma situação concreta que mostra a solução funcionando.', percent: 28 },
  { id: 'p5', name: 'Convite', instruction: 'O que muda e uma ação só.', percent: 15 },
] };

const MARTA: Persona = {
  name: 'Marta', tagline: 'Gerente de RH que já se decepcionou com estagiário e prefere contratar gente pronta', role: 'Gestora de RH de empresa de médio porte',
  data: {
    age: '41', role: 'Gerente de RH de uma rede regional de supermercados', location: 'Região metropolitana',
    bio: 'Cuida da contratação de mais de cem pessoas por ano. Já abriu programa de estágio, viu metade dos jovens sair antes do fim e ouviu da diretoria que era dinheiro jogado fora.',
    goals: ['Reduzir a rotatividade', 'Ter gente de confiança para as vagas de entrada', 'Mostrar resultado para a diretoria'],
    pains: ['Estagiário que some sem avisar', 'Gastar semanas treinando quem sai em dois meses', 'Diretoria cética com programa de jovens'],
    objections: ['Não tenho gente para ficar acompanhando estagiário', 'Já tentei e não deu certo'],
    triggers: ['Casos de empresas parecidas', 'Algo que não dê trabalho extra para a equipe'],
    channels: ['LinkedIn', 'Instagram', 'eventos de RH'], quote: 'Eu até quero dar a chance, mas não posso recomeçar a seleção a cada dois meses.',
  },
};

const CASES: Case[] = [
  {
    name: 'estagio-publico-geral', kind: 'ideia', persona: null, territory: 'Pipeline de jovens talentos', videoFormat: 'curto', seconds: 45,
    idea: {
      pain: 'Muitos jovens que conseguem o primeiro estágio largam a vaga nos primeiros meses, e muitas empresas ficam com vagas de estágio e trainee abertas por falta de candidatos preparados para o dia a dia do trabalho.',
      impact: 'O jovem volta para casa com a sensação de que falhou e perde uma porta que custou muito a abrir, muitas vezes a única renda extra da família. A empresa perde o tempo e o dinheiro gastos para receber e treinar alguém e precisa começar a procurar tudo de novo.',
      cause: 'A escola ensina matéria, mas quase nunca ensina a falar numa reunião, a pedir ajuda, a cumprir horário ou a lidar com uma crítica do chefe. Quem vem de um bairro com poucas oportunidades chega ao primeiro emprego sem ninguém por perto que já tenha passado por isso. No primeiro tropeço, sem apoio, muitos desistem ou nem chegam a ser escolhidos.',
      guide: 'Responsabilidade de uns com os outros: ninguém chega longe sozinho.',
      args: 'Começar cedo, ainda no ensino médio, com encontros práticos sobre comunicação, trabalho em equipe e postura profissional.\nLigar cada jovem a um mentor voluntário que já trabalha e conversa com ele antes e durante o primeiro estágio.\nAproximar empresas parceiras para que conheçam os jovens antes de abrir as vagas.\nAcompanhar os primeiros meses de cada jovem no trabalho, com conversas regulares entre jovem, mentor e empresa.',
      gain: 'Mais jovens ficam no estágio, ganham experiência e renda, e as empresas preenchem as vagas com gente preparada, sem ter de recomeçar a seleção a cada poucos meses.',
      desire: 'Quem dá o primeiro passo no trabalho se sente seguro, acompanhado e orgulhoso de mostrar do que é capaz, e quem ajudou sente a alegria de ver o bastão passado.',
      cta: 'Se você tem uma empresa ou trabalha em uma, converse com a gente sobre abrir um espaço para jovens em início de carreira.',
    },
  },
  {
    name: 'curriculo-persona', kind: 'ideia', persona: SHELTON, territory: 'Primeiro emprego', videoFormat: 'longo', seconds: 60,
    idea: {
      pain: 'Todas as vagas pedem dois anos de experiência que ele não tem como ter.',
      impact: 'Ele sente que nunca vai começar e perde a confiança a cada currículo sem resposta.',
      cause: 'As empresas esperam o jovem pronto, e quase ninguém abre a porta para quem está começando.',
      guide: 'Cuidado coletivo: uma comunidade que abre espaço para quem chega.',
      args: 'Quem treina a entrevista antes chega mais seguro.\nUm mentor encurta o caminho.\nA empresa que conhece o jovem antes escolhe melhor.',
      gain: 'Mais jovens conseguem a primeira vaga.', desire: 'Orgulho de se firmar.', cta: 'Mande para alguém que está procurando o primeiro emprego.',
    },
  },
  {
    name: 'rh-persona-empresa', kind: 'ideia', persona: MARTA, territory: 'Empresas parceiras', videoFormat: 'curto', seconds: 45,
    idea: {
      pain: 'A empresa abre vaga de estágio, investe semanas no treinamento e o jovem sai antes de completar três meses.',
      impact: 'A equipe se cansa de treinar gente nova, a diretoria passa a ver o programa de jovens como desperdício e a vaga volta para o mural.',
      cause: 'O jovem chega sem saber as regras não escritas do trabalho e sem ninguém de fora com quem conversar quando algo dá errado. A empresa, sozinha, não tem tempo para fazer esse acompanhamento.',
      guide: 'Parceria: ninguém precisa carregar o peso sozinho.',
      args: 'O jovem chega depois de um treino prático de postura e comunicação.\nUm mentor voluntário de fora da empresa acompanha o jovem nos primeiros meses.\nA empresa conhece o jovem antes de contratar.',
      gain: 'A vaga é preenchida por alguém que fica, e a equipe não precisa recomeçar o treinamento.',
      desire: 'A gestora mostra para a diretoria um programa de jovens que deu certo.',
      cta: 'Converse com a gente para receber jovens da próxima turma na sua empresa.',
    },
  },
  {
    name: 'tema-pedir-ajuda', kind: 'tema', persona: null, territory: '', videoFormat: 'curto', seconds: 30,
    text: 'Como pedir ajuda no primeiro emprego sem parecer que não sabe nada.',
  },
  {
    name: 'material-encontro-mentores', kind: 'material', persona: null, territory: '', videoFormat: 'longo', seconds: 60,
    text: `Anotações do encontro de mentores (sábado, sede da organização)

- Abrimos com a pergunta: o que vocês queriam ter ouvido no primeiro emprego? A Carla (mentora, analista de RH) disse que queria ter ouvido que errar no começo é esperado, e que o problema é esconder o erro.
- Os mentores contaram que a maior dúvida dos jovens não é técnica. É "posso perguntar de novo?", "o que eu falo na reunião?", "posso usar o celular?".
- Combinado do grupo: cada mentor manda uma mensagem curta para o seu jovem na véspera do primeiro dia de trabalho, e outra no fim da primeira semana, perguntando o que foi mais difícil.
- Um mentor contou que o jovem dele quase pediu demissão depois de uma bronca do gerente. Conversaram por telefone à noite, ele entendeu que a bronca era sobre o prazo e não sobre ele, e no dia seguinte foi falar com o gerente. Continua no estágio.
- Pedido para a próxima turma: precisamos de mais mentores que trabalhem em áreas administrativas e de tecnologia. O compromisso é de uma conversa a cada quinze dias, por seis meses.
- Próximo encontro de formação de mentores: a definir.`,
  },
];

const ideaOf = (c: Case) => (c.idea ? ideaBlockFor(c.idea, c.persona, c.persona?.name ?? '', c.territory) : '');
const personaBriefOf = (p: Persona | null) => (p ? `${personaBlock(p)}${p.data.quote ? `\nFrase típica: ${p.data.quote}` : ''}${p.data.channels.length ? `\nOnde está: ${p.data.channels.join('; ')}` : ''}` : undefined);
let spent = 0;
const track = (label: string, i: number, o: number) => { const v = costUsd(i, o); spent += v; return `Tokens: ${i} entrada / ${o} saída · ~US$ ${v.toFixed(3)} (${label})`; };

const CLICHES = /(no mundo de hoje|mergulh\w+|jornada|em suma|vale ressaltar|é importante destacar|você não vai acreditar|fica comigo até o final|descubra|você sabia|mud(?:a|ou) tudo|faz toda a diferen[çc]a|a boa not[íi]cia|ningu[ée]m nasce sabendo|empurr[ãa]o que faltava|encurta\w* (?:o caminho|a estrada)|zona de conforto|aqui est[áa] o n[óo])/i;
const TEASE = /(e a[ií] tudo muda|outro detalhe|tem um detalhe|aqui est[aá] o problema|n[aã]o [eé] a que todo mundo|mas tem mais|o que ningu[eé]m conta|spoiler)/i;
const NOT_X_IS_Y = /(?<![\wà-ú])n[ãa]o (?:[ée]|foi|era)(?![\wà-ú])[^.!?;:]{1,70}[.,;]\s+(?:[ée]|foi|era)(?![\wà-ú])/gi;
const tics = (t: string) => (t.match(NOT_X_IS_Y) ?? []).length;
const personaLeak = (c: Case, t: string) => !!c.persona && new RegExp(`\\b${c.persona.name}\\b`).test(t);
const GENERIC_CTA = /(siga a p[aá]gina|siga (o perfil|a gente|n[oó]s)|ative o sininho|deixe seu like|curta e compartilhe)/i;

function report(file: string, md: string) { mkdirSync('eval-out', { recursive: true }); writeFileSync(`eval-out/${file}.md`, md); console.log(`\n=== ${file} ===\n${md}`); }
const flag = (ok: boolean, label: string, detail = '') => `${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`;

async function carrossel(c: Case) {
  // como no app: ideia → modo "ideia" (com a persona no bloco e o público da marca omitido); tema → modo "tema"; material → tema + fatos permitidos
  const r = await generatePost({
    editor: 'carrossel', mode: c.kind === 'ideia' ? 'ideia' : 'tema', brief: c.kind === 'ideia' ? ideaOf(c) : c.kind === 'tema' ? c.text! : 'Um carrossel a partir do material abaixo (anotações de um encontro).',
    slidesTarget: 0, facts: c.kind === 'material' ? c.text! : '', instructions: '', angle: 'auto', plan: null, brand: c.persona ? { ...brand, audience: '' } : brand,
  });
  const slides = r.slides as { format?: string; html?: string }[];
  const texts = slides.map((s, i) => `**${i + 1}. [${s.format}]** ${plainText(String(s.html ?? '').replace(/<\/(h2|p|li)>/g, '\n'))}`);
  const rev = reviewCarousel(slides);
  const all = slides.map((s) => plainText(String(s.html ?? ''))).join(' ');
  const checks = [...rev.map((x) => flag(x.ok, x.label, x.detail)), flag(!CLICHES.test(all), 'Sem clichês de IA'), flag(!TEASE.test(all), 'Sem ganchos vazios'), flag(!GENERIC_CTA.test(all), 'Sem CTA genérica'), flag(new Set(slides.map((s) => s.format)).size >= 4, 'Variedade de formatos (3+ além da capa)', [...new Set(slides.map((s) => s.format))].join(', ')), flag(!CLICHES.test(r.caption), 'Legenda sem clichês'), flag(tics(`${all} ${r.caption}`) <= 1, '"Não é X, é Y" no máximo 1x', `${tics(`${all} ${r.caption}`)}x`), flag(!personaLeak(c, `${all} ${r.caption}`), 'Sem o nome interno da persona')];
  report(`carrossel-${c.name}`, `# Carrossel · ${c.name}\n\n**Título:** ${r.title}\n\n## Slides\n\n${texts.join('\n\n')}\n\n## Capas alternativas\n${r.coverOptions.map((x) => `- ${x}`).join('\n')}\n\n## Legenda\n${r.caption}\n\n## Notas\n${r.notes.map((n) => `- ${n}`).join('\n')}\n\n## Checagens\n${checks.join('\n')}\n\n${track('carrossel', r.inputTokens, r.outputTokens)}\n`);
}

async function video(c: Case) {
  const format = c.videoFormat === 'longo' ? LONG : SHORT;
  const seconds = c.seconds, secs = allocate(format.parts, seconds);
  // como no app: a ideia vira ideaBrief + IDEA_INSTRUCTIONS + persona; tema e material passam pelo plano de ideias, aqui simplificado em uma ideia direta
  const content = c.kind === 'ideia' ? ideaBrief(c.idea!, c.persona?.name ?? '', c.territory) : c.text!;
  const idea = c.kind === 'ideia'
    ? { title: ideaTitle(c.idea!.pain), angle: ideaAngle(c.idea!), points: ideaPoints(c.idea!) }
    : { title: c.kind === 'tema' ? c.text!.slice(0, 120) : 'O que os mentores aprenderam com a primeira semana de trabalho dos jovens', angle: c.kind === 'tema' ? 'Mostrar que pedir ajuda bem feito é sinal de profissionalismo, não de fraqueza.' : 'A maior dúvida do jovem no primeiro emprego não é técnica; uma mensagem do mentor na hora certa muda o desfecho.', points: [] as string[] };
  const r = await generateVideoScript({ content, format, seconds, platform: 'all', instructions: c.kind === 'ideia' ? IDEA_INSTRUCTIONS : '', brand, idea, personaBrief: personaBriefOf(c.persona) });
  const body = r.data.parts.map((p, i) => `**${p.name}** (${secs[i]}s, máx ~${wordsFor(secs[i])} palavras · fala tem ${countWords(p.speech)})\n- Fala: ${p.speech}\n- Tela: ${p.onScreen}\n- Visual: ${p.visual}`).join('\n\n');
  const all = r.data.parts.map((p) => p.speech).join(' ');
  const checks = [...r.data.parts.map((p, i) => flag(countWords(p.speech) <= wordsFor(secs[i]) + 3, `${p.name} cabe no tempo`, `${countWords(p.speech)}/${wordsFor(secs[i])} palavras`)), flag(!CLICHES.test(all), 'Sem clichês'), flag(!TEASE.test(all), 'Sem ganchos vazios'), flag(!GENERIC_CTA.test(all), 'Sem CTA genérica'), flag(!CLICHES.test(r.data.caption), 'Legenda sem clichês'), flag(tics(`${all} ${r.data.caption}`) <= 1, '"Não é X, é Y" no máximo 1x', `${tics(`${all} ${r.data.caption}`)}x`), flag(!personaLeak(c, `${all} ${r.data.caption}`), 'Sem o nome interno da persona')];
  report(`video-${c.name}`, `# Roteiro · ${c.name} (${format.name}, ${seconds}s)\n\n**Título:** ${r.title}\n\n${body}\n\n## Legenda\n${r.data.caption}\n${r.data.hashtags.map((h) => `#${h}`).join(' ')}\n\n## Notas\n${r.data.notes.map((n) => `- ${n}`).join('\n')}\n\n## Checagens\n${checks.join('\n')}\n\n${track('vídeo', r.inputTokens, r.outputTokens)}\n`);
}

// rótulos iguais aos do app (lib/substack-server.ts)
const SOURCE_LABEL = {
  ideia: 'IDEIA DE CONTEÚDO (a base do artigo: transforme esta história em um texto de newsletter, não repita os campos como lista)',
  tema: 'TEMA DO ARTIGO',
  material: 'MATERIAL-FONTE (use somente fatos daqui; reescreva com a voz da marca, sem copiar trechos)',
} as const;

async function artigo(c: Case) {
  const a = await writeArticle({ source: { label: SOURCE_LABEL[c.kind], text: c.kind === 'ideia' ? ideaOf(c) : c.text! }, angle: 'auto', length: c.kind === 'tema' ? 'curto' : 'medio', instructions: '', brand, plan: null });
  const rev = reviewArticle(a);
  const checks = [...rev.map((x) => flag(x.ok, x.label, x.detail)), flag(!CLICHES.test(a.body), 'Sem clichês de IA'), flag(!GENERIC_CTA.test(a.body), 'Sem CTA genérica'), flag(tics(a.body) <= 2, '"Não é X, é Y" no máximo 2x', `${tics(a.body)}x`), flag(!personaLeak(c, `${a.title} ${a.body}`), 'Sem o nome interno da persona')];
  report(`artigo-${c.name}`, `# Artigo · ${c.name}\n\n**Estratégia:** ${a.strategy}\n\n# ${a.title}\n*${a.subtitle}*\n\n${a.body}\n\n---\n## Publicação\n- Assunto: ${a.meta.emailSubject}\n- Prévia: ${a.meta.previewText}\n- SEO: ${a.meta.seoDescription}\n- Tags: ${a.meta.tags.join(', ')}\n${a.meta.notes.map((n, i) => `- Note ${i + 1}: ${n}`).join('\n')}\n\n## A conferir\n${a.meta.toVerify.map((n) => `- ${n}`).join('\n')}\n\n## Checagens\n${checks.join('\n')}\n\n${track('artigo', a.inputTokens, a.outputTokens)}\n`);
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Defina ANTHROPIC_API_KEY ou EVAL_ANTHROPIC_API_KEY (este script faz chamadas reais).'); process.exit(1); }
  const what = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all';
  const ci = process.argv.indexOf('--case'); const only = ci > 0 ? Number(process.argv[ci + 1]) : null;
  const cases = CASES.filter((_, i) => only === null || i === only);
  for (const c of cases) {
    if (what === 'all' || what === 'carrossel') await carrossel(c).catch((e) => console.error('carrossel falhou:', e.message));
    if (what === 'all' || what === 'video') await video(c).catch((e) => console.error('vídeo falhou:', e.message));
    if (what === 'all' || what === 'artigo') await artigo(c).catch((e) => console.error('artigo falhou:', e.message));
  }
  const line = `${new Date().toISOString()} · ${what}${only !== null ? ` caso ${only}` : ''} · ~US$ ${spent.toFixed(3)}`;
  mkdirSync('eval-out', { recursive: true }); appendFileSync('eval-out/_custo.log', `${line}\n`);
  console.log(`\nCusto desta rodada: ~US$ ${spent.toFixed(3)} (acumulado em eval-out/_custo.log)`);
})();
