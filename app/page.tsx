import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Instrument_Serif } from 'next/font/google';
import { auth } from '@clerk/nextjs/server';
import { IconSpark } from './icons';
import s from './landing.module.css';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Criador de Posts — carrosséis e Tweet Cards com IA',
  description: 'Crie carrosséis e Tweet Cards com a identidade da sua marca, gere posts, imagens e legendas com IA e baixe em PNG, PDF ou ZIP para cada rede.',
};

const I = {
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" />,
  down: <><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.5 6.5-5.5S15.5 16.4 15.5 20" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.5 0 4.5 1.5 4.5 4.5" /></>,
};
const Ico = ({ d }: { d: keyof typeof I }) => <span className={s.ico}><svg viewBox="0 0 24 24">{I[d]}</svg></span>;

const FEATURES: { icon: keyof typeof I; title: React.ReactNode; text: string }[] = [
  { icon: 'bolt', title: <>Posts em lote <em>com IA</em></>, text: 'Cole temas ou roteiros prontos e a IA escreve (ou estrutura) vários posts de uma vez, no tom de voz e nas regras da sua marca. Tudo chega como rascunho para você revisar.' },
  { icon: 'image', title: <>Imagens e <em>galeria</em></>, text: 'Gere imagens com IA a partir do texto de cada slide, aprove a descrição antes, peça ajustes e reaproveite o que já existe na galeria da marca, com busca por palavras.' },
  { icon: 'edit', title: <>Ajuste com <em>aprovação</em></>, text: 'Dê um feedback sobre um slide e veja a sugestão ao lado do texto atual. A IA considera o post inteiro para não repetir nem contradizer. Você aprova ou pede outro ajuste.' },
  { icon: 'chat', title: <>Legenda <em>pronta</em></>, text: 'Cada post nasce com legenda para Instagram, TikTok ou X, no limite de caracteres de cada rede e com as regras de hashtags da sua marca. Ajuste por pedido e copie.' },
  { icon: 'down', title: <>Uma conta, <em>cada rede</em></>, text: 'Cada rede tem o seu @. Baixe PNG ou PDF, ou um ZIP com uma pasta por rede, cada arquivo já com o @ certo aplicado. O arquivo sai igual ao que você vê na tela.' },
  { icon: 'team', title: <>Marcas e <em>equipe</em></>, text: 'Cada marca tem posts, cores, galeria e membros próprios, com convite por e-mail e papéis de administrador ou membro. Converta posts entre carrossel e Tweet Card quando precisar.' },
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
          <Link href={href} className={s.pillBtn}>Entrar</Link>
        </header>

        <section className={s.hero}>
          <span className={s.badge}><i className={s.dot} />IA que escreve, ilustra e exporta</span>
          <h1 className={`${s.h1} ${s.serif}`}>Posts com a cara da sua marca, <em>prontos em minutos.</em></h1>
          <p className={s.lead}>Monte carrosséis e Tweet Cards no editor visual, gere posts, imagens e legendas com IA no tom da sua marca e baixe em PNG, PDF ou ZIP para cada rede.</p>
          <div className={s.ctas}>
            <Link href={href} className={s.btnPrimary}>Entrar na plataforma <span aria-hidden>↗</span></Link>
            <a href="#como-funciona" className={s.btnGhost}>Como funciona</a>
          </div>

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
              <div className={s.ai}>✨ Ajustar texto com IA</div>
              <div className={s.sw}>Mostrar perfil</div>
              <div className={s.sw}>Mostrar “Veja mais”</div>
              <div className={s.acc}><span className={s.ic} /><span>Cores<small>Tema do template</small></span></div>
              <div className={s.acc}><span className={s.ic} /><span>Baixar<small>PNG, PDF e ZIP por conta</small></span></div>
            </div>
          </div>
        </section>

        <section className={s.sec}>
          <div className={s.eyebrow}>Dois formatos</div>
          <h2 className={`${s.h2} ${s.serif}`}>Carrossel ou <em>Tweet Card.</em></h2>
          <p className={s.sub}>Os dois no mesmo editor, com as cores, a fonte e o perfil da sua marca aplicados.</p>
          <div className={s.formats}>
            <div className={s.fmtCard}>
              <div className={s.fmtArt}>
                <div className={s.mini}><i className={s.o} /><i className={s.b} /><i /><i className={s.s} /><div className={s.im} /></div>
                <div className={s.mini}><i className={s.o} /><i className={s.b} /><i /><i /><i className={s.s} /></div>
                <div className={s.mini}><i className={s.o} /><i className={s.b} /><i /><i className={s.s} /><div className={s.im} /></div>
              </div>
              <h3 className={s.serif}>Carrossel <em>de feed</em></h3>
              <p>Capa, texto, texto com imagem ou só imagem em slides 1080×1350, com listas, destaque de texto, ajuste de imagem e exportação em PNG, PDF ou ZIP.</p>
            </div>
            <div className={s.fmtCard}>
              <div className={`${s.fmtArt} ${s.tw}`}>
                <div className={s.tcard}><b><span />Sua Marca</b>O algoritmo muda, a consistência não. Poste com estratégia, não com pressa.<em>💬 754 &nbsp; ⇄ 2.641 &nbsp; ♡ 25K</em></div>
              </div>
              <h3 className={s.serif}>Tweet <em>Card</em></h3>
              <p>Cards no estilo de post de rede social, com logo, imagem dentro do card ou de fundo, botão, métricas e posição do card no topo, centro ou base.</p>
            </div>
          </div>
        </section>

        <section className={s.sec}>
          <div className={s.eyebrow}>Tudo em um lugar</div>
          <h2 className={`${s.h2} ${s.serif}`}>Da ideia ao arquivo, <em>sem sair daqui.</em></h2>
          <div className={s.grid3}>
            {FEATURES.map((f, i) => (
              <article key={i} className={s.card}>
                <div className={s.cardTop}><Ico d={f.icon} /><span className={s.num}>0{i + 1}</span></div>
                <h3 className={s.serif}>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={s.sec} id="como-funciona">
          <div className={s.eyebrow}>Como funciona</div>
          <h2 className={`${s.h2} ${s.serif}`}>Três passos e <em>pronto.</em></h2>
          <div className={s.steps}>
            <div className={s.step}><b>1</b><h3 className={s.serif}>Configure a marca</h3><p>Nome, @ de cada rede, foto, cores, tom de voz, regras e estilo visual das imagens. Isso vale para todos os posts.</p></div>
            <div className={s.step}><b>2</b><h3 className={s.serif}>Crie ou gere</h3><p>Escreva no editor ou peça à IA vários posts de uma vez a partir de temas e roteiros. Ela não inventa dados e avisa o que conferir.</p></div>
            <div className={s.step}><b>3</b><h3 className={s.serif}>Revise e baixe</h3><p>Ajuste textos e imagens, copie a legenda e baixe os arquivos de cada rede. Nada é publicado sozinho.</p></div>
          </div>
        </section>
      </div>

      <section className={s.cta}>
        <h2 className={`${s.h2} ${s.serif}`}>Seu próximo post <em>já pode estar pronto.</em></h2>
        <p>Entre na plataforma, escolha a sua marca e crie o primeiro carrossel em minutos.</p>
        <Link href={href} className={s.btnDark}>Entrar na plataforma <span aria-hidden>↗</span></Link>
      </section>

      <div className={s.wrap}><footer className={s.foot}><span>© 2026 Criador de Posts</span><span>O acesso é por convite da sua marca.</span></footer></div>
    </div>
  );
}
