import Link from 'next/link';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas, personas, posts, substackPosts, territories, videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { IconBulb, IconCheck, IconMap, IconNewsletter, IconPosts, IconSettings, IconTarget, IconVideo } from '../icons';

export const metadata = { title: 'Início' };

const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

/** Início: o caminho de trabalho em 4 passos, com o que já foi feito e o próximo passo em destaque. */
export default async function Inicio() {
  const c = (await getCtx())!;
  const b = c.brandId;
  const [about, nTerr, nIdeas, nApproved, nPersonas, nPosts, nVideos, nArticles] = await Promise.all([
    db.select({ about: brandSettings.aiAbout }).from(brandSettings).where(eq(brandSettings.brandId, b)).then((r) => r[0]?.about ?? ''),
    n(db.select({ n: count() }).from(territories).where(eq(territories.brandId, b))),
    n(db.select({ n: count() }).from(contentIdeas).where(eq(contentIdeas.brandId, b))),
    n(db.select({ n: count() }).from(contentIdeas).where(and(eq(contentIdeas.brandId, b), eq(contentIdeas.status, 'approved')))),
    n(db.select({ n: count() }).from(personas).where(eq(personas.brandId, b))),
    n(db.select({ n: count() }).from(posts).where(eq(posts.brandId, b))),
    n(db.select({ n: count() }).from(videoScripts).where(eq(videoScripts.brandId, b))),
    n(db.select({ n: count() }).from(substackPosts).where(eq(substackPosts.brandId, b))),
  ]);
  const nContent = nPosts + nVideos + nArticles;

  const steps = [
    {
      key: 'marca', icon: <IconSettings />, title: 'Conte quem é a sua marca', done: about.trim().length >= 40,
      text: 'O que você faz, para quem e como fala. A IA usa isso em tudo o que cria, então é o passo que mais melhora os textos.',
      status: about.trim().length >= 40 ? 'Pronto' : 'Falta preencher "O que a organização faz"',
      href: '/admin/configuracoes', cta: 'Preencher a marca',
    },
    {
      key: 'temas', icon: <IconMap />, title: 'Escolha os temas que você quer ocupar', done: nTerr > 0,
      text: 'Os territórios são os assuntos sobre os quais você quer ser lembrado. A IA sugere a partir da sua marca; você ajusta.',
      status: nTerr ? `${nTerr} ${nTerr === 1 ? 'tema' : 'temas'} no mapa` : 'Nenhum tema ainda',
      href: '/admin/territorios', cta: nTerr ? 'Abrir o mapa' : 'Gerar os temas com IA',
    },
    {
      key: 'ideias', icon: <IconBulb />, title: 'Gere ideias para cada tema', done: nIdeas > 0,
      text: 'Cada ideia já vem com a dor, o argumento e o convite final. Aprove as que valem a pena virar conteúdo.',
      status: nIdeas ? `${nIdeas} ${nIdeas === 1 ? 'ideia' : 'ideias'}${nApproved ? ` · ${nApproved} ${nApproved === 1 ? 'aprovada' : 'aprovadas'}` : ''}` : 'Nenhuma ideia ainda',
      href: nIdeas ? '/admin/ideias' : '/admin/ideias?gerar=1', cta: nIdeas ? 'Ver as ideias' : 'Gerar ideias',
    },
    {
      key: 'conteudo', icon: <IconPosts />, title: 'Transforme as ideias em conteúdo', done: nContent > 0,
      text: 'Abra uma ideia e escolha o formato: carrossel ou post de imagem, roteiro de vídeo ou artigo para o Substack.',
      status: nContent ? [nPosts && `${nPosts} ${nPosts === 1 ? 'post' : 'posts'}`, nVideos && `${nVideos} ${nVideos === 1 ? 'roteiro' : 'roteiros'}`, nArticles && `${nArticles} ${nArticles === 1 ? 'artigo' : 'artigos'}`].filter(Boolean).join(' · ') : 'Nada criado ainda',
      href: '/admin/ideias', cta: 'Escolher uma ideia',
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  const allDone = next === -1;

  return (
    <div className="page home">
      <div className="page-head">
        <div>
          <h1>Olá! Vamos criar o conteúdo de {c.brandName}</h1>
          <p>Siga os passos na ordem. {allDone ? 'O caminho básico está pronto: agora é repetir os passos 3 e 4.' : 'O próximo passo está em destaque.'}</p>
        </div>
      </div>

      {allDone && (
        <div className="card-surface home-next">
          <div><b>{nApproved ? `${nApproved} ${nApproved === 1 ? 'ideia aprovada espera' : 'ideias aprovadas esperam'} virar conteúdo` : 'Que tal novas ideias?'}</b>
            <small>{nApproved ? 'Abra uma delas e escolha o formato.' : 'Escolha um tema do mapa e gere mais ideias.'}</small></div>
          <Link href={nApproved ? '/admin/ideias' : '/admin/territorios'} className="btn primary">{nApproved ? 'Criar conteúdo' : 'Gerar mais ideias'}</Link>
        </div>
      )}

      <ol className="home-steps">
        {steps.map((s, i) => {
          const isNext = i === next;
          return (
            <li key={s.key} className={`card-surface home-step${s.done ? ' done' : ''}${isNext ? ' next' : ''}`}>
              <span className="home-num">{s.done ? <IconCheck /> : i + 1}</span>
              <div className="home-body">
                <div className="home-title"><span className="home-ic">{s.icon}</span><b>{s.title}</b>{isNext && <span className="pill dark">Próximo passo</span>}</div>
                <p className="muted">{s.text}</p>
                <small className="home-status">{s.status}</small>
              </div>
              <Link href={s.href} className={`btn ${isNext ? 'primary' : 'small'}`}>{s.cta}</Link>
            </li>
          );
        })}
      </ol>

      <div className="home-extra">
        <div className="card-surface home-tip">
          <span className="home-ic"><IconTarget /></span>
          <div><b>Personas (opcional)</b><small>{nPersonas ? `${nPersonas} ${nPersonas === 1 ? 'persona criada' : 'personas criadas'}. ` : ''}Quer falar com públicos específicos? Crie personas e escolha uma (ou várias) ao gerar ideias. Sem persona, o conteúdo fala com o público geral.</small></div>
          <Link href="/admin/personas" className="btn small ghost">{nPersonas ? 'Ver personas' : 'Criar personas'}</Link>
        </div>
        <div className="card-surface home-tip">
          <span className="home-ic"><IconVideo /></span>
          <div><b>Já tem um assunto na cabeça?</b><small>Dá para pular o planejamento e criar direto a partir de um tema ou de um texto seu.</small></div>
          <div className="home-quick">
            <Link href="/admin/gerar" className="btn small ghost"><IconPosts /> Post</Link>
            <Link href="/admin/videos/gerar" className="btn small ghost"><IconVideo /> Roteiro</Link>
            <Link href="/admin/substack/novo" className="btn small ghost"><IconNewsletter /> Artigo</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
