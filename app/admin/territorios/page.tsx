import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { GROUP_COLORS, splitPersonaName } from '@/lib/persona';
import type { TNode } from '@/lib/territory';
import { IconTarget } from '../../icons';
import { EmptyState, PageHead } from '../ui';
import { AboutCard } from './about-card';
import { GeneralView } from './general-view';
import { MindMap } from './mind-map';

export const metadata = { title: 'Territórios' };

const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export default async function TerritoriosPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const c = (await getCtx())!;
  const { p } = await searchParams;
  const [people, rows, [bs]] = await Promise.all([
    db.select({ id: personas.id, name: personas.name, tagline: personas.tagline, data: personas.data }).from(personas).where(eq(personas.brandId, c.brandId)).orderBy(personas.createdAt),
    db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
      .from(territories).where(eq(territories.brandId, c.brandId)),
    db.select({ about: brandSettings.aiAbout }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
  ]);
  const about = bs?.about ?? '';
  const nodes = rows as TNode[];
  const list = people.map((x) => ({ id: x.id, name: x.name, tagline: x.tagline, role: x.data.role }));

  if (!list.length) {
    return (
      <div className="page">
        <PageHead title="Territórios" description="O mapa de temas de conteúdo de cada persona, em formato de mapa mental." />
        <EmptyState icon={<IconTarget />} title="Crie uma persona primeiro" action={<Link href="/admin/personas" className="btn primary">Ir para Personas</Link>}>
          Os territórios são organizados por persona: cada uma tem o seu mapa. Crie ou gere personas e volte aqui.
        </EmptyState>
      </div>
    );
  }

  const general = p === 'geral';
  const current = general ? null : list.find((x) => x.id === p) ?? list[0];
  const idx = current ? list.findIndex((x) => x.id === current.id) : 0;
  const countOf = (id: string) => nodes.filter((n) => n.personaId === id).length;

  return (
    <div className="page tr-page">
      <PageHead
        title="Territórios"
        description={general ? 'Visão geral: os mapas de todas as personas juntos, sem repetições.' : 'O mapa de temas de conteúdo desta persona. Gere com IA ou crie à mão, com quantos níveis precisar.'}
      />
      <AboutCard about={about} canEdit={c.isBrandAdmin} />
      <nav className="tr-tabs" aria-label="Personas">
        {list.map((x, i) => (
          <Link key={x.id} href={`/admin/territorios?p=${x.id}`} className={`tr-tab${!general && current?.id === x.id ? ' on' : ''}`} aria-current={!general && current?.id === x.id ? 'page' : undefined}>
            <span className="pe-av sm" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }}>{initialsOf(x.name)}</span>
            <span className="tr-tab-name" title={x.name}><b>{splitPersonaName(x.name).first}</b>{splitPersonaName(x.name).label && <small>{splitPersonaName(x.name).label}</small>}</span><i>{countOf(x.id)}</i>
          </Link>
        ))}
        <Link href="/admin/territorios?p=geral" className={`tr-tab geral${general ? ' on' : ''}`} aria-current={general ? 'page' : undefined}><span>Geral</span><i>{nodes.length}</i></Link>
      </nav>

      {general ? (
        <GeneralView personas={list} nodes={nodes} />
      ) : current ? (
        <MindMap key={current.id} persona={current} color={GROUP_COLORS[idx % GROUP_COLORS.length]} nodes={nodes.filter((n) => n.personaId === current.id)} hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'} hasAbout={!!about.trim()} />
      ) : null}
    </div>
  );
}
