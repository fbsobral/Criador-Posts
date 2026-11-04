import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { SUBSTACK_DAILY_LIMIT, articlesToday, isUuid } from '@/lib/substack-server';
import { PageHead } from '../../ui';
import { Studio } from './studio';

export const metadata = { title: 'Novo artigo · Substack' };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ ideia?: string }> }) {
  const c = (await getCtx())!;
  const { ideia } = await searchParams;
  const rows = await db.select().from(contentIdeas).where(and(eq(contentIdeas.brandId, c.brandId), ne(contentIdeas.status, 'used'))).orderBy(desc(contentIdeas.updatedAt)).limit(120);
  const used = ideia && isUuid(ideia) && !rows.some((r) => r.id === ideia)
    ? await db.select().from(contentIdeas).where(and(eq(contentIdeas.id, ideia), eq(contentIdeas.brandId, c.brandId)))
    : [];
  const ideas = [...used, ...rows].map((r) => ({ id: r.id, pain: r.pain, personaName: r.personaName, territory: r.territory, cta: r.cta }));
  const remaining = Math.max(0, SUBSTACK_DAILY_LIMIT - (await articlesToday(c.brandId)));
  return (
    <div className="page">
      <PageHead back={{ href: '/admin/substack', label: 'Artigos' }} title="Novo artigo" description="Escolha de onde ele nasce, aprove o esboço e deixe a IA escrever o primeiro rascunho. Depois, é só lapidar." />
      <Studio ideas={ideas} initialIdeaId={ideia && isUuid(ideia) ? ideia : ''} hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'} remaining={remaining} />
    </div>
  );
}
