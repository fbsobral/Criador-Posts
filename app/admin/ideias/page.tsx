import { eq, desc, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas, personas, templates, territories, videoFormats } from '@/db/schema';
import { supportsAi } from '@/lib/ai/generate';
import { getCtx } from '@/lib/ctx';
import { brandSettings } from '@/db/schema';
import type { Idea, IdeaStatus } from '@/lib/idea';
import { PUBLICO_ID, type TNode } from '@/lib/territory';
import { PageHead } from '../ui';
import { IdeasView } from './ideas-view';

export const metadata = { title: 'Ideias de conteúdo' };

export default async function IdeiasPage({ searchParams }: { searchParams: Promise<{ p?: string; t?: string; gerar?: string }> }) {
  const c = (await getCtx())!;
  const sp = await searchParams;
  const [rows, people, nodes, [bs], vformats, tpls] = await Promise.all([
    db.select().from(contentIdeas).where(eq(contentIdeas.brandId, c.brandId)).orderBy(desc(contentIdeas.createdAt)),
    db.select({ id: personas.id, name: personas.name }).from(personas).where(eq(personas.brandId, c.brandId)).orderBy(personas.position, personas.createdAt),
    db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
      .from(territories).where(eq(territories.brandId, c.brandId)),
    db.select({ about: brandSettings.aiAbout }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    db.select().from(videoFormats).where(or(isNull(videoFormats.brandId), eq(videoFormats.brandId, c.brandId))).orderBy(videoFormats.name),
    db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name),
  ]);
  const ideas: Idea[] = rows.map((r) => ({
    id: r.id, personaId: r.personaId, personaName: r.personaName, territoryId: r.territoryId, territory: r.territory,
    pain: r.pain, impact: r.impact, cause: r.cause, guide: r.guide, plan: r.plan, gain: r.gain, desire: r.desire, cta: r.cta, status: r.status as IdeaStatus, source: r.source, createdAt: r.createdAt.toISOString(),
  }));
  const tnodes = nodes.map((n) => ({ ...n, personaId: n.personaId ?? PUBLICO_ID })) as TNode[];
  return (
    <div className="page">
      <PageHead title="Ideias de conteúdo" description="Cada ideia conta uma história para uma persona: da dor ao impacto, à causa, ao guia (enquadramento), ao plano, ao ganho, ao desejo e à CTA. Gere com IA a partir de um território ou escreva à mão." />
      <IdeasView ideas={ideas} personas={people} nodes={tnodes} hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'} hasAbout={!!(bs?.about ?? '').trim()}
        formats={vformats.map((f) => ({ id: f.id, name: f.name, description: f.description, defaultSeconds: f.defaultSeconds, parts: f.parts }))}
        templates={tpls.filter((t) => supportsAi(t.editor)).map((t) => ({ id: t.id, name: t.name, description: t.description, editor: t.editor }))}
        initial={{ persona: sp.p ?? '', territory: sp.t ?? '', generate: sp.gerar === '1' || !!sp.t }} />
    </div>
  );
}
