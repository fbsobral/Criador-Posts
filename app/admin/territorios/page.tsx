import Link from 'next/link';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas, personaGroups, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { GROUP_COLORS, splitPersonaName } from '@/lib/persona';
import { priorityOf } from '@/lib/priority';
import { PUBLICO_ID, type TNode } from '@/lib/territory';
import { PageHead } from '../ui';
import { AboutCard } from './about-card';
import { GeneralView } from './general-view';
import { MindMap } from './mind-map';
import { PersonaPicker } from './persona-picker';
import { PriorityBar } from './priority-bar';

export const metadata = { title: 'Territórios' };

const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export default async function TerritoriosPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const c = (await getCtx())!;
  const { p } = await searchParams;
  const [people, rows, [bs], groups, approvedRows] = await Promise.all([
    db.select({ id: personas.id, name: personas.name, tagline: personas.tagline, data: personas.data, groupId: personas.groupId }).from(personas).where(eq(personas.brandId, c.brandId)).orderBy(personas.position, personas.createdAt),
    db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source, score: territories.score, scoreReason: territories.scoreReason })
      .from(territories).where(eq(territories.brandId, c.brandId)),
    db.select({ about: brandSettings.aiAbout, icp: brandSettings.personaIcp, aud: brandSettings.aiAudience, pc: brandSettings.priorityConfig }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    db.select({ id: personaGroups.id, name: personaGroups.name }).from(personaGroups).where(eq(personaGroups.brandId, c.brandId)).orderBy(personaGroups.position, personaGroups.createdAt),
    // ideias aprovadas (ou já usadas, que passaram pela aprovação) por território
    db.select({ id: contentIdeas.territoryId, n: count() }).from(contentIdeas)
      .where(and(eq(contentIdeas.brandId, c.brandId), isNotNull(contentIdeas.territoryId), inArray(contentIdeas.status, ['approved', 'used']))).groupBy(contentIdeas.territoryId),
  ]);
  const approved = Object.fromEntries(approvedRows.map((r) => [r.id as string, r.n]));
  const gIndex = new Map(groups.map((g, i) => [g.id, i]));
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  // mesma cor do grupo no quadro de Personas
  const colorOfGroup = (gid: string | null) => (gid && gIndex.has(gid) ? GROUP_COLORS[gIndex.get(gid)! % GROUP_COLORS.length] : '#8A857A');
  const about = bs?.about ?? '';
  const priority = priorityOf(bs?.pc);
  const hasKey = !!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1';
  const nodes = rows.map((r) => ({ ...r, personaId: r.personaId ?? PUBLICO_ID })) as TNode[];
  const list = people.map((x) => ({ id: x.id, name: x.name, tagline: x.tagline, role: x.data.role, color: colorOfGroup(x.groupId), group: x.groupId ? gName.get(x.groupId) : undefined, groupId: x.groupId }));
  const icpText = bs?.icp || bs?.aud || '';
  const publico = { color: '#16140F', groupId: null as string | null, id: PUBLICO_ID, name: 'Público geral', tagline: icpText ? (icpText.length > 140 ? `${icpText.slice(0, 140)}…` : icpText) : 'Territórios para o público como um todo, sem focar numa persona.', role: 'Sem persona' };
  const withPublico = nodes.some((n) => n.personaId === PUBLICO_ID) ? [...list, publico] : list;

  const general = p === 'geral';
  const all = [...list, publico];
  const current = general ? null : all.find((x) => x.id === p) ?? all[0];
  const idx = current ? all.findIndex((x) => x.id === current.id) : 0;
  const countOf = (id: string) => nodes.filter((n) => n.personaId === id).length;

  return (
    <div className="page tr-page">
      <PageHead
        title="Territórios"
        description="Os temas de conteúdo de cada persona, em mapa, com a prioridade de cada pauta."
        actions={<PriorityBar config={priority} scores={nodes.map((n) => n.score ?? null)} total={nodes.length} canEdit={c.isBrandAdmin} hasKey={hasKey} />}
      />
      <AboutCard about={about} canEdit={c.isBrandAdmin} />
      <nav className="tr-tabs" aria-label="Personas e visões">
        <Link href={`/admin/territorios?p=${PUBLICO_ID}`} className={`tr-tab geral${!general && current?.id === PUBLICO_ID ? ' on' : ''}`} aria-current={!general && current?.id === PUBLICO_ID ? 'page' : undefined} title="Territórios sem persona: consideram o ICP e todas as personas"><span className="tr-tab-name"><b>Público geral</b><small>sem persona</small></span><i>{countOf(PUBLICO_ID)}</i></Link>
        <Link href="/admin/territorios?p=geral" className={`tr-tab geral${general ? ' on' : ''}`} aria-current={general ? 'page' : undefined}><span>Visão geral</span><i>{nodes.length}</i></Link>
        <span className="tr-tabs-sep" aria-hidden />
        <PersonaPicker currentId={!general && current && current.id !== PUBLICO_ID ? current.id : null}
          groups={[...groups.map((g) => ({ key: g.id, label: g.name, color: colorOfGroup(g.id), items: list.filter((x) => x.groupId === g.id) })), { key: 'none', label: 'Sem grupo', color: '#8A857A', items: list.filter((x) => !x.groupId || !gIndex.has(x.groupId)) }]
            .filter((g) => g.items.length > 0).map((g) => ({ ...g, items: g.items.map((x) => ({ id: x.id, name: x.name, color: x.color, count: countOf(x.id) })) }))} />
      </nav>

      {general ? (
        <GeneralView personas={withPublico} nodes={nodes} />
      ) : current ? (
        <MindMap key={current.id} persona={current} color={(current as { color?: string }).color ?? GROUP_COLORS[idx % GROUP_COLORS.length]} nodes={nodes.filter((n) => n.personaId === current.id)} hasKey={hasKey} priority={priority} approved={approved} hasAbout={!!about.trim()} />
      ) : null}
    </div>
  );
}
