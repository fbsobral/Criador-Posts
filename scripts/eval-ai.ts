/**
 * Avaliação da qualidade da IA com chamadas REAIS (gasta créditos da API).
 * Gera carrossel, roteiro de vídeo e artigo a partir de ideias de exemplo, mostra o resultado
 * e aplica checagens automáticas de craft. Serve para afinar os prompts em ciclos: rodar, ler, ajustar, rodar de novo.
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/eval-ai.ts [carrossel|video|artigo|all] [--case N]
 *
 * Os resultados ficam em eval-out/<alvo>-<caso>.md (fora do git).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { generatePost } from '../lib/ai/generate';
import type { BrandProfile } from '../lib/ai/generate';
import { generateVideoScript } from '../lib/ai/video';
import { writeArticle } from '../lib/ai/substack';
import { ideaBlockFor } from '../lib/ai/carousel';
import { reviewCarousel } from '../lib/ai/carousel-rules';
import { countWords, plainText, reviewArticle } from '../lib/substack';
import { allocate, wordsFor } from '../lib/video';
import type { IdeaFields } from '../lib/idea';

const brand: BrandProfile = {
  brandName: 'D.C.T-Youths', niche: 'Mentoria e primeiro emprego para jovens de bairros com poucas oportunidades', audience: 'Jovens de 16 a 24 anos, empresas parceiras e mentores voluntários',
  voice: 'Próxima, direta e esperançosa. Fala como quem conversa com um amigo. Sem jargão, sem sermão.', rules: 'Nunca culpar o jovem. Não inventar números. Mostrar a causa coletiva e a solução prática.',
  cta: 'Convidar a agir de forma simples (mandar para alguém, falar com a organização).', examples: '', captionRules: '', about: 'Organização que prepara jovens para o primeiro emprego com treino, mentoria e parceria com empresas.',
};

type Case = { name: string; persona: string; territory: string; idea: IdeaFields };
const CASES: Case[] = [
  {
    name: 'estagio-publico-geral', persona: '', territory: 'Pipeline de jovens talentos',
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
    name: 'currículo-persona', persona: 'Shelton, 24 anos, recém-formado, manda currículo todo dia e ouve que falta experiência', territory: 'Primeiro emprego',
    idea: {
      pain: 'Todas as vagas pedem dois anos de experiência que ele não tem como ter.',
      impact: 'Ele sente que nunca vai começar e perde a confiança a cada currículo sem resposta.',
      cause: 'As empresas esperam o jovem pronto, e quase ninguém abre a porta para quem está começando.',
      guide: 'Cuidado coletivo: uma comunidade que abre espaço para quem chega.',
      args: 'Quem treina a entrevista antes chega mais seguro.\nUm mentor encurta o caminho.\nA empresa que conhece o jovem antes escolhe melhor.',
      gain: 'Mais jovens conseguem a primeira vaga.', desire: 'Orgulho de se firmar.', cta: 'Mande para alguém que está procurando o primeiro emprego.',
    },
  },
];

const CLICHES = /(no mundo de hoje|mergulh\w+|jornada|em suma|vale ressaltar|é importante destacar|você não vai acreditar|fica comigo até o final|descubra|você sabia)/i;
const TEASE = /(e a[ií] tudo muda|outro detalhe|tem um detalhe|aqui est[aá] o problema|n[aã]o [eé] a que todo mundo)/i;

function report(file: string, md: string) { mkdirSync('eval-out', { recursive: true }); writeFileSync(`eval-out/${file}.md`, md); console.log(`\n=== ${file} ===\n${md}`); }
const flag = (ok: boolean, label: string, detail = '') => `${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`;

async function carrossel(c: Case) {
  const persona = c.persona ? { name: c.persona, tagline: '', role: '', data: { age: '', role: '', location: '', bio: c.persona, goals: [], pains: [], objections: [], triggers: [], channels: [], quote: '' } } : null;
  const r = await generatePost({ editor: 'carrossel', mode: 'ideia', brief: ideaBlockFor(c.idea, persona as never, c.persona, c.territory), slidesTarget: 0, facts: '', instructions: '', angle: 'auto', plan: null, brand });
  const slides = r.slides as { format?: string; html?: string }[];
  const texts = slides.map((s, i) => `**${i + 1}. [${s.format}]** ${plainText(String(s.html ?? '').replace(/<\/(h2|p|li)>/g, '\n'))}`);
  const rev = reviewCarousel(slides);
  const all = slides.map((s) => plainText(String(s.html ?? ''))).join(' ');
  const checks = [...rev.map((x) => flag(x.ok, x.label, x.detail)), flag(!CLICHES.test(all), 'Sem clichês de IA'), flag(!TEASE.test(all), 'Sem ganchos vazios'), flag(new Set(slides.map((s) => s.format)).size >= 3, 'Variedade de formatos', [...new Set(slides.map((s) => s.format))].join(', '))];
  report(`carrossel-${c.name}`, `# Carrossel · ${c.name}\n\n**Título:** ${r.title}\n\n## Slides\n\n${texts.join('\n\n')}\n\n## Capas alternativas\n${r.coverOptions.map((x) => `- ${x}`).join('\n')}\n\n## Legenda\n${r.caption}\n\n## Notas\n${r.notes.map((n) => `- ${n}`).join('\n')}\n\n## Checagens\n${checks.join('\n')}\n\nTokens: ${r.inputTokens} entrada / ${r.outputTokens} saída\n`);
}

async function video(c: Case) {
  const format = { name: 'Gancho + virada + CTA', parts: [{ id: 'p1', name: 'Gancho', instruction: 'Pare o scroll nos primeiros 3 segundos com uma cena ou contradição específica. Sem apresentação.', percent: 20 }, { id: 'p2', name: 'Virada e prova', instruction: 'Explique a causa em linguagem simples e mostre, com uma situação concreta, o que muda.', percent: 55 }, { id: 'p3', name: 'CTA', instruction: 'Uma única ação clara, dita de forma natural.', percent: 25 }] };
  const seconds = 45, secs = allocate(format.parts, seconds);
  const r = await generateVideoScript({ content: ideaBlockFor(c.idea, null, c.persona, c.territory), format, seconds, platform: 'all', instructions: '', brand, idea: { title: c.idea.pain.slice(0, 90), angle: c.idea.cause.slice(0, 200), points: c.idea.args.split('\n').slice(0, 3) } });
  const body = r.data.parts.map((p, i) => `**${p.name}** (${secs[i]}s, máx ~${wordsFor(secs[i])} palavras · fala tem ${countWords(p.speech)})\n- Fala: ${p.speech}\n- Tela: ${p.onScreen}\n- Visual: ${p.visual}`).join('\n\n');
  const all = r.data.parts.map((p) => p.speech).join(' ');
  const checks = [...r.data.parts.map((p, i) => flag(countWords(p.speech) <= wordsFor(secs[i]) + 3, `${p.name} cabe no tempo`, `${countWords(p.speech)}/${wordsFor(secs[i])} palavras`)), flag(!CLICHES.test(all), 'Sem clichês')];
  report(`video-${c.name}`, `# Roteiro · ${c.name}\n\n**Título:** ${r.title}\n\n${body}\n\n## Legenda\n${r.data.caption}\n${r.data.hashtags.map((h) => `#${h}`).join(' ')}\n\n## Checagens\n${checks.join('\n')}\n`);
}

async function artigo(c: Case) {
  const a = await writeArticle({ source: { label: 'IDEIA DE CONTEÚDO (a base do artigo)', text: ideaBlockFor(c.idea, null, c.persona, c.territory) }, angle: 'auto', length: 'medio', instructions: '', brand, plan: null });
  const rev = reviewArticle(a);
  const checks = [...rev.map((x) => flag(x.ok, x.label, x.detail)), flag(!CLICHES.test(a.body), 'Sem clichês de IA')];
  report(`artigo-${c.name}`, `# Artigo · ${c.name}\n\n**Estratégia:** ${a.strategy}\n\n# ${a.title}\n*${a.subtitle}*\n\n${a.body}\n\n---\n## Publicação\n- Assunto: ${a.meta.emailSubject}\n- Prévia: ${a.meta.previewText}\n- SEO: ${a.meta.seoDescription}\n- Tags: ${a.meta.tags.join(', ')}\n${a.meta.notes.map((n, i) => `- Note ${i + 1}: ${n}`).join('\n')}\n\n## Checagens\n${checks.join('\n')}\n`);
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Defina ANTHROPIC_API_KEY (este script faz chamadas reais).'); process.exit(1); }
  const what = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all';
  const ci = process.argv.indexOf('--case'); const only = ci > 0 ? Number(process.argv[ci + 1]) : null;
  const cases = CASES.filter((_, i) => only === null || i === only);
  for (const c of cases) {
    if (what === 'all' || what === 'carrossel') await carrossel(c).catch((e) => console.error('carrossel falhou:', e.message));
    if (what === 'all' || what === 'video') await video(c).catch((e) => console.error('vídeo falhou:', e.message));
    if (what === 'all' || what === 'artigo') await artigo(c).catch((e) => console.error('artigo falhou:', e.message));
  }
})();
