import Link from 'next/link';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas, personaGroups, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { GROUP_COLORS } from '@/lib/persona';
import { priorityOf } from '@/lib/priority';
import { effectivePersonas } from '@/lib/territory';
import { loadTerritoryNodes } from '@/lib/territory-server';
import { OrgPill } from '../org-pill';
import { PageHead } from '../ui';
import { AboutCard } from './about-card';
import { MatrixView } from './matrix-view';
import { MindMap } from './mind-map';
import { PersonaPicker } from './persona-picker';
import { PriorityBar } from './priority-bar';

export const metadata = { title: 'Territórios' };

export default async function TerritoriosPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string; n?: string }> }) {
  const c = (await getCtx())!;
  const sp = await searchParams;
  const [people, nodes, [bs], groups, approvedRows, pairRows, totalRows] = await Promise.all([
    db.select({ id: personas.id, name: personas.name, tagline: personas.tagline, data: personas.data, groupId: personas.groupId }).from(personas).where(eq(personas.brandId, c.brandId)).orderBy(personas.position, personas.createdAt),
    loadTerritoryNodes(c.brandId),
    db.select({ about: brandSettings.aiAbout, pc: brandSettings.priorityConfig }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    db.select({ id: personaGroups.id, name: personaGroups.name }).from(personaGroups).where(eq(personaGroups.brandId, c.brandId)).orderBy(personaGroups.position, personaGroups.createdAt),
    // ideias aprovadas (ou já usadas, que passaram pela aprovação) por território
    db.select({ id: contentIdeas.territoryId, n: count() }).from(contentIdeas)
      .where(and(eq(contentIdeas.brandId, c.brandId), isNotNull(contentIdeas.territoryId), inArray(contentIdeas.status, ['approved', 'used']))).groupBy(contentIdeas.territoryId),
    // ideias por dupla território × persona (para a matriz)
    db.select({ t: contentIdeas.territoryId, p: contentIdeas.personaId, n: count() }).from(contentIdeas)
      .where(and(eq(contentIdeas.brandId, c.brandId), isNotNull(contentIdeas.territoryId), isNotNull(contentIdeas.personaId))).groupBy(contentIdeas.territoryId, contentIdeas.personaId),
    // total de ideias por território, de qualquer estágio e com ou sem persona (para o aviso ao excluir)
    db.select({ t: contentIdeas.territoryId, n: count() }).from(contentIdeas)
      .where(and(eq(contentIdeas.brandId, c.brandId), isNotNull(contentIdeas.territoryId))).groupBy(contentIdeas.territoryId),
  ]);
  const approved = Object.fromEntries(approvedRows.map((r) => [r.id as string, r.n]));
  const ideaCounts = Object.fromEntries(pairRows.map((r) => [`${r.t}|${r.p}`, r.n]));
  const ideaTotals: Record<string, number> = {};
  for (const r of totalRows) ideaTotals[r.t as string] = r.n;
  const gIndex = new Map(groups.map((g, i) => [g.id, i]));
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  // mesma cor do grupo no quadro de Personas
  const colorOfGroup = (gid: string | null) => (gid && gIndex.has(gid) ? GROUP_COLORS[gIndex.get(gid)! % GROUP_COLORS.length] : '#8A857A');
  const about = bs?.about ?? '';
  const priority = priorityOf(bs?.pc);
  const hasKey = !!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1';
  const list = people.map((x) => ({ id: x.id, name: x.name, tagline: x.tagline, role: x.data.role, color: colorOfGroup(x.groupId), group: x.groupId ? gName.get(x.groupId) : undefined, groupId: x.groupId }));

  const matrix = sp.v === 'matriz' || sp.p === 'geral'; // "?p=geral" era a antiga visão geral
  const sel = sp.n && nodes.some((n) => n.id === sp.n) ? sp.n : null;
  let lens = !matrix ? list.find((x) => x.id === sp.p) ?? null : null;
  if (lens && sel && !effectivePersonas(nodes, sel).includes(lens.id)) lens = null; // o tema pedido não está na lente: mostra o mapa todo
  const countOf = (id: string) => nodes.filter((n) => effectivePersonas(nodes, n.id).includes(id)).length;

  return (
    <div className="page tr-page">
      <PageHead
        title="Territórios"
        description="Os assuntos sobre os quais a marca quer ser lembrada. Monte o mapa (a IA sugere) e, em cada tema, gere ideias de conteúdo: é o próximo passo."
        actions={<><OrgPill name={c.brandName} /><PriorityBar config={priority} scores={nodes.map((n) => n.score ?? null)} total={nodes.length} canEdit={c.isBrandAdmin} hasKey={hasKey} /></>}
      />
      <AboutCard about={about} canEdit={c.isBrandAdmin} />
      <nav className="tr-tabs" aria-label="Visões do mapa">
        <Link href="/admin/territorios" className={`tr-tab geral${!matrix && !lens ? ' on' : ''}`} aria-current={!matrix && !lens ? 'page' : undefined} title="O mapa inteiro da marca, com as personas ligadas em cada tema"><span className="tr-tab-name"><b>Mapa da marca</b><small>todas as personas</small></span><i>{nodes.length}</i></Link>
        <PersonaPicker currentId={lens?.id ?? null} label="Ver como uma persona"
          groups={[...groups.map((g) => ({ key: g.id, label: g.name, color: colorOfGroup(g.id), items: list.filter((x) => x.groupId === g.id) })), { key: 'none', label: 'Sem grupo', color: '#8A857A', items: list.filter((x) => !x.groupId || !gIndex.has(x.groupId)) }]
            .filter((g) => g.items.length > 0).map((g) => ({ ...g, items: g.items.map((x) => ({ id: x.id, name: x.name, color: x.color, count: countOf(x.id) })) }))} />
        <span className="tr-tabs-sep" aria-hidden />
        <Link href="/admin/territorios?v=matriz" className={`tr-tab geral${matrix ? ' on' : ''}`} aria-current={matrix ? 'page' : undefined} title="Quais temas já têm ideias para cada persona, e onde há lacuna"><span className="tr-tab-name"><b>Matriz</b><small>território × persona</small></span></Link>
      </nav>

      {matrix ? (
        <MatrixView personas={list} nodes={nodes} ideaCounts={ideaCounts} hasKey={hasKey} hasAbout={!!about.trim()} />
      ) : (
        <MindMap key={lens?.id ?? 'todas'} lens={lens} personas={list} brandName={c.brandName} nodes={nodes} hasKey={hasKey} priority={priority} approved={approved} ideaTotals={ideaTotals} hasAbout={!!about.trim()} initialSelected={sel} />
      )}
    </div>
  );
}
