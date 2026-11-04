import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Instrument_Serif } from 'next/font/google';
import { auth } from '@clerk/nextjs/server';
import { IconSpark } from './icons';
import s from './landing.module.css';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Criador de Posts — da estratégia ao post, com IA',
  description: 'Defina personas, mapeie temas, transforme em ideias completas e produza posts de imagem e roteiros de vídeo com a identidade da sua marca. A IA sugere, você aprova.',
};

const I = {
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  map: <><circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="5.5" r="2.2" /><circle cx="19" cy="12" r="2.2" /><circle cx="19" cy="18.5" r="2.2" /><path d="M7.2 12H11c2 0 2-6.5 4-6.5M11 12h6.8M7.2 12H11c2 0 2 6.5 4 6.5" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" /></>,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" />,
  down: <><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.5 6.5-5.5S15.5 16.4 15.5 20" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.5 0 4.5 1.5 4.5 4.5" /></>,
  video: <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="M16 10l5-3v10l-5-3" /></>,
  board: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="9.5" y="4" width="5" height="10" rx="1.5" /><rect x="16" y="4" width="5" height="13" rx="1.5" /></>,
  play: <path d="M7 5l12 7-12 7z" />,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.6" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>,
};
const Ico = ({ d }: { d: keyof typeof I }) => <span className={s.ico}><svg viewBox="0 0 24 24">{I[d]}</svg></span>;

type Feat = { icon: keyof typeof I; title: React.ReactNode; text: string };

const IMAGE_FEATURES: Feat[] = [
  { icon: 'edit', title: <>Editor <em>visual</em></>, text: 'Carrossel, Carrossel Feed, Tweet Card e Capa de Notícia, com as cores, a fonte e o perfil da sua marca. Edite o texto no próprio slide e veja o resultado como ele será baixado.' },
  { icon: 'bolt', title: <>Posts em lote <em>com IA</em></>, text: 'Cole até 30 temas, ou textos prontos, e a IA escreve (ou estrutura) vários posts de uma vez, no tom e nas regras da marca. Tudo chega como rascunho para revisar.' },
  { icon: 'image', title: <>Imagens e <em>galeria</em></>, text: 'Gere imagens com IA a partir do texto de cada slide, reaproveite o que já existe na galeria e encontre qualquer imagem por palavras.' },
  { icon: 'chat', title: <>Legenda <em>pronta</em></>, text: 'Cada post nasce com legenda para a rede escolhida, no limite de caracteres e com as regras de hashtags da marca. Peça ajustes e copie.' },
  { icon: 'grid', title: <>Templates <em>da marca</em></>, text: 'Use os formatos da plataforma ou crie os seus. Converta um post entre formatos quando a ideia pedir outro jeito de contar.' },
  { icon: 'down', title: <>Uma conta, <em>cada rede</em></>, text: 'Cada rede tem o seu @. Baixe PNG, PDF ou um ZIP com uma pasta por rede, cada arquivo com o @ certo. Nada é publicado sozinho.' },
];

const VIDEO_FEATURES: Feat[] = [
  { icon: 'video', title: <>Roteiro por <em>partes</em></>, text: 'Gancho, dica, CTA… cada formato define as partes e o peso de tempo de cada uma. A IA escreve fala, texto na tela e o que mostrar, no limite de palavras.' },
  { icon: 'play', title: <>Teleprompter e <em>tempo</em></>, text: 'O editor conta as palavras de cada parte e avisa se o vídeo cabe na duração. O teleprompter mostra a fala em tela cheia para gravar.' },
  { icon: 'board', title: <>Esteira de <em>produção</em></>, text: 'Rascunho, Revisado, Gravado, Editado e Publicado. Arraste os roteiros entre as etapas ou mude pelo seletor no celular.' },
];

const STRATEGY: { icon: keyof typeof I; kicker: string; title: React.ReactNode; text: string; points: string[]; mock: 'personas' | 'map' | 'board' }[] = [
  { icon: 'target', kicker: 'Personas', title: <>Quem você quer <em>alcançar</em></>, text: 'Descreva o seu público e a IA propõe grupos e personas realistas, com dores, objetivos e objeções. Peça personas só para um grupo, refine uma a uma e arraste entre os grupos.', points: ['Grupos e personas gerados por IA, com instruções opcionais', 'Linguagem do dia a dia, sem jargão', 'Refinar com IA em cada persona'], mock: 'personas' },
  { icon: 'map', kicker: 'Territórios', title: <>O mapa dos <em>temas</em></>, text: 'Um mapa mental com os temas da marca. Parta das dores de uma persona ou de um debate maior e traduza cada tema para o dia a dia de cada persona.', points: ['Mapa único com lente por persona e matriz de cobertura', 'Tradução do tema para cada persona, escrita pela IA e revisada por você', 'Prioridade por critérios que você define'], mock: 'map' },
  { icon: 'bulb', kicker: 'Ideias de conteúdo', title: <>Histórias que <em>sustentam</em> o post</>, text: 'Cada ideia reúne dor, impacto, causa, guia, argumentos, ganho, desejo e CTA. Defina o objetivo, refine bloco a bloco e acompanhe no quadro por estágio.', points: ['Quadro Ideia, Aprovada e Já usada, com arrastar e soltar', 'A IA lê as ideias que já existem para não repetir', 'Um clique cria o roteiro ou o post'], mock: 'board' },
];

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/admin/posts'); // quem já está logado vai direto ao painel
  const href = '/sign-in';
  return (
    <div className={`${s.page} ${serif.variable}`}>
      <div className={s.wrap}>
        <header className={s.nav}>
          <div className={s.logo}><span className={s.mark}><IconSpark /></span>Criador de Posts</div>
          <nav className={s.links} aria-label="Seções">
            <a href="#estrategia">Estratégia</a><a href="#producao">Produção</a><a href="#video">Vídeo</a><a href="#como-funciona">Como funciona</a>
          </nav>
          <Link href={href} className={s.pillBtn}>Entrar</Link>
        </header>

        <section className={s.hero}>
          <span className={s.badge}><i className={s.dot} />Estratégia, texto, imagem e vídeo, com IA</span>
          <h1 className={`${s.h1} ${s.serif}`}>Da estratégia ao post, <em>sem perder o fio.</em></h1>
          <p className={s.lead}>Defina para quem você fala, escolha os temas, transforme em ideias completas e produza posts de imagem e roteiros de vídeo com a identidade da sua marca. A IA sugere; você decide.</p>
          <div className={s.ctas}>
            <Link href={href} className={s.btnPrimary}>Entrar na plataforma <span aria-hidden>↗</span></Link>
            <a href="#como-funciona" className={s.btnGhost}>Como funciona</a>
          </div>

          <div className={s.flow} aria-hidden>
            <div className={s.node}><span className={s.nk}>Persona</span><div className={s.av}>H</div><b>Helena, a engenheira que mora fora</b><small>quer ajudar os jovens de lá</small></div>
            <i className={s.arrow} />
            <div className={s.node}><span className={s.nk}>Território</span><div className={s.tree}><u>Acesso ao ensino superior</u><u className={s.sb}>Custos e bolsas</u><u className={s.sb}>Primeiro estágio</u></div></div>
            <i className={s.arrow} />
            <div className={s.node}><span className={s.nk}>Ideia</span><div className={s.lines}><i className={s.hi} /><i /><i className={s.sm} /></div><small>dor · argumentos · CTA</small></div>
            <i className={s.arrow} />
            <div className={`${s.node} ${s.out}`}><span className={s.nk}>Conteúdo</span><div className={s.outs}><span><svg viewBox="0 0 24 24">{I.grid}</svg>Post</span><span><svg viewBox="0 0 24 24">{I.video}</svg>Roteiro</span></div><small>com a sua identidade</small></div>
          </div>
        </section>

        <section className={s.sec} id="estrategia">
          <div className={s.eyebrow}>Estratégia</div>
          <h2 className={`${s.h2} ${s.serif}`}>Antes do post, <em>o que dizer e para quem.</em></h2>
          <p className={s.sub}>Três módulos que organizam o pensamento e alimentam todo o conteúdo.</p>
          <div className={s.strat}>
            {STRATEGY.map((m) => (
              <article key={m.kicker} className={s.sCard}>
                <div className={`${s.mock} ${s[`m_${m.mock}`]}`} aria-hidden>
                  {m.mock === 'personas' && (<>
                    <div className={s.col}><b>Doadores</b><div className={s.pc}><span className={s.pav} /><i /><i className={s.sm} /></div><div className={s.pc}><span className={`${s.pav} ${s.b}`} /><i /><i className={s.sm} /></div></div>
                    <div className={s.col}><b>Mentores</b><div className={s.pc}><span className={`${s.pav} ${s.g}`} /><i /><i className={s.sm} /></div><div className={s.ai}>✨ Sugerir com IA</div></div>
                  </>)}
                  {m.mock === 'map' && (<div className={s.mm}>
                    <div className={s.root}>Marca</div>
                    <div className={s.branches}>
                      <div className={`${s.bn} ${s.o}`}>Moradia e aluguel<em><span /><span className={s.b} /></em></div>
                      <div className={`${s.bn} ${s.bl}`}>Trabalho por app<em><span /></em></div>
                      <div className={`${s.bn} ${s.pu}`}>Saúde pública<em><span className={s.g} /><span /></em></div>
                    </div>
                  </div>)}
                  {m.mock === 'board' && (<>
                    <div className={s.col}><b>Ideia</b><div className={s.ic2}><i /><i className={s.sm} /></div><div className={s.ic2}><i /><i className={s.sm} /></div></div>
                    <div className={s.col}><b>Aprovada</b><div className={s.ic2}><i /><i className={s.sm} /></div></div>
                    <div className={s.col}><b>Já usada</b><div className={s.ic2}><i /><i className={s.sm} /></div></div>
                  </>)}
                </div>
                <div className={s.sBody}>
                  <div className={s.cardTop}><Ico d={m.icon} /><span className={s.num}>{m.kicker}</span></div>
                  <h3 className={s.serif}>{m.title}</h3>
                  <p>{m.text}</p>
                  <ul className={s.ticks}>{m.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>

          <div className={s.paths}>
            <div className={s.path}><h3 className={s.serif}>Persona <em>→</em> território <em>→</em> ideia</h3><p>Parta das dores de uma pessoa: o que ela vive, teme e precisa decidir. Os temas nascem da vida dela.</p></div>
            <div className={s.path}><h3 className={s.serif}>Território <em>→</em> persona <em>→</em> ideia</h3><p>Parta de um tema maior, um debate coletivo, e traduza para cada persona. O que é de todos também chega a cada um.</p></div>
          </div>
        </section>

        <section className={s.sec} id="producao">
          <div className={s.eyebrow}>Produção de imagem</div>
          <h2 className={`${s.h2} ${s.serif}`}>Carrossel, Tweet Card e Capa de Notícia, <em>com a cara da marca.</em></h2>
          <p className={s.sub}>Edite no editor visual, gere em lote com IA e baixe para cada rede.</p>

          <div className={s.shot} aria-hidden>
            <div className={s.rail}>
              <div className={`${s.th} ${s.on}`}><i className={s.b} /><i /><i className={s.s} /></div>
              <div className={s.th}><i className={s.b} /><i /><i /></div>
              <div className={s.th}><i className={s.b} /><i className={s.s} /></div>
            </div>
            <div className={s.stageMock}>
              <div className={s.slideMock}>
                <div className={s['sm-eyebrow']}><span>MARKETING DE CONTEÚDO</span><span>2026</span></div>
                <div className={s['sm-who']}><span />Sua Marca</div>
                <div className={s['sm-title']}>5 erros que travam o seu crescimento no Instagram</div>
                <div className={s['sm-text']}>Um roteiro simples para publicar com consistência e transformar seguidores em clientes.</div>
                <div className={s['sm-img']} />
              </div>
              <div className={s.tweetMock}><div><b><span />Sua Marca</b>Quem aparece todo dia, vende todo dia. Veja como manter o ritmo sem se esgotar.</div></div>
            </div>
            <div className={s.pnl}>
              <div className={s.acc}><span className={s.ic} /><span>Este slide<small>Formato, texto e imagem</small></span></div>
              <div className={s.ai}>✨ Refinar com IA</div>
              <div className={s.sw}>Mostrar perfil</div>
              <div className={s.sw}>Mostrar “Veja mais”</div>
              <div className={s.acc}><span className={s.ic} /><span>Cores<small>Tema do template</small></span></div>
              <div className={s.acc}><span className={s.ic} /><span>Baixar<small>PNG, PDF e ZIP por conta</small></span></div>
            </div>
          </div>

          <div className={s.grid3}>
            {IMAGE_FEATURES.map((f, i) => (
              <article key={i} className={s.card}>
                <div className={s.cardTop}><Ico d={f.icon} /><span className={s.num}>0{i + 1}</span></div>
                <h3 className={s.serif}>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={s.sec} id="video">
          <div className={s.eyebrow}>Roteiros de vídeo</div>
          <h2 className={`${s.h2} ${s.serif}`}>Reels, TikTok e Shorts, <em>parte por parte.</em></h2>
          <p className={s.sub}>Do conteúdo-fonte ao roteiro pronto para gravar, com acompanhamento até a publicação.</p>
          <div className={s.vid}>
            <div className={s.vmock} aria-hidden>
              <div className={s.pbar}><span className={s.p1}>Gancho</span><span className={s.p2}>Dica</span><span className={s.p3}>CTA</span></div>
              <div className={s.vrow}><b>Gancho · 9s</b><p>Por que tanto jovem larga o primeiro estágio em poucos meses?</p><span>Texto na tela: Não é preguiça</span></div>
              <div className={s.vrow}><b>Dica · 39s</b><p>A escola ensina matéria, mas quase nunca ensina a falar numa reunião…</p><span>22/23 palavras · cabe no tempo</span></div>
              <div className={s.stages}><span>Rascunho</span><span className={s.on}>Revisado</span><span>Gravado</span><span>Editado</span><span>Publicado</span></div>
            </div>
            <div className={s.vfeat}>
              {VIDEO_FEATURES.map((f, i) => (
                <article key={i} className={s.vcard}>
                  <Ico d={f.icon} />
                  <div><h3 className={s.serif}>{f.title}</h3><p>{f.text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={s.sec}>
          <div className={s.eyebrow}>IA com aprovação</div>
          <h2 className={`${s.h2} ${s.serif}`}>A IA sugere. <em>Você decide.</em></h2>
          <p className={s.sub}>Em cada bloco de texto há um botão Refinar com IA. Você vê o antes e o depois e só aplica se gostar.</p>
          <div className={s.review}>
            <div className={s.diff} aria-hidden>
              <span className={s.dl}>Dica · Fala</span>
              <s>A escola ensina matéria. Mas quase nunca ensina a falar numa reunião, pedir ajuda, cumprir horário. Aí, o que fazer? Começar cedo, ligar o jovem a um mentor, aproximar a empresa…</s>
              <p>Imagina o Pedro, de 17 anos: treinou a entrevista com a Marta, que já trabalha, e no primeiro estágio já sabia o que perguntar. Foi isso que mudou para ele.</p>
              <div className={s.dbtn}><span className={s.ok}>✓ Aplicar nesta parte</span><span>Pedir outro ajuste</span><span>Descartar</span></div>
            </div>
            <ul className={s.ticks}>
              <li>Refinar por bloco: cada caixa de uma ideia, cada parte do roteiro e a legenda</li>
              <li>Ao aplicar, o texto é salvo na hora, e dá para desfazer</li>
              <li>A IA não inventa números, datas nem fontes, e marca o que precisa ser conferido</li>
              <li>Ela aprende a sua marca: o que a organização faz, o tom de voz e as regras</li>
            </ul>
          </div>
        </section>

        <section className={s.sec}>
          <div className={s.eyebrow}>Marcas, equipe e celular</div>
          <h2 className={`${s.h2} ${s.serif}`}>Para a equipe toda, <em>em qualquer tela.</em></h2>
          <div className={s.grid3} style={{ marginTop: 44 }}>
            <article className={s.card}><div className={s.cardTop}><Ico d="team" /><span className={s.num}>01</span></div><h3 className={s.serif}>Marcas e <em>equipe</em></h3><p>Cada marca tem seus posts, personas, ideias, galeria, cores e membros. Convide por e-mail e defina quem é administrador ou membro.</p></article>
            <article className={s.card}><div className={s.cardTop}><Ico d="phone" /><span className={s.num}>02</span></div><h3 className={s.serif}>Feito para o <em>celular</em></h3><p>Menu inferior com os atalhos principais, janelas que abrem de baixo para cima e quadros que funcionam com toque. Revise e aprove de onde estiver.</p></article>
            <article className={s.card}><div className={s.cardTop}><Ico d="help" /><span className={s.num}>03</span></div><h3 className={s.serif}>Guia em <em>cada módulo</em></h3><p>Um tour no primeiro acesso e um guia curto na primeira visita a cada módulo. O botão ? reabre a ajuda quando você quiser.</p></article>
          </div>
        </section>

        <section className={s.sec} id="como-funciona">
          <div className={s.eyebrow}>Como funciona</div>
          <h2 className={`${s.h2} ${s.serif}`}>Quatro passos e <em>pronto.</em></h2>
          <div className={s.steps4}>
            <div className={s.step}><b>1</b><h3 className={s.serif}>Configure a marca</h3><p>O que a organização faz, tom de voz, regras, cores e @ de cada rede. Vale para tudo.</p></div>
            <div className={s.step}><b>2</b><h3 className={s.serif}>Desenhe a estratégia</h3><p>Personas, territórios e ideias, pelo caminho que fizer mais sentido para você.</p></div>
            <div className={s.step}><b>3</b><h3 className={s.serif}>Produza</h3><p>Posts de imagem e roteiros de vídeo, um a um ou em lote, a partir das ideias.</p></div>
            <div className={s.step}><b>4</b><h3 className={s.serif}>Revise e baixe</h3><p>Ajuste com a IA, aprove e baixe os arquivos. Nada é publicado sozinho.</p></div>
          </div>
        </section>
      </div>

      <section className={s.cta}>
        <h2 className={`${s.h2} ${s.serif}`}>Seu próximo conteúdo <em>já tem estratégia.</em></h2>
        <p>Entre na plataforma, escolha a sua marca e siga o tour de boas-vindas: em minutos você tem as primeiras ideias.</p>
        <Link href={href} className={s.btnDark}>Entrar na plataforma <span aria-hidden>↗</span></Link>
      </section>

      <div className={s.wrap}><footer className={s.foot}><span>© 2026 Criador de Posts</span><span>O acesso é por convite da sua marca.</span></footer></div>
    </div>
  );
}
