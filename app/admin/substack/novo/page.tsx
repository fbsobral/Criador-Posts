import Link from 'next/link';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas } from '@/db/schema';
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
  const [bs] = await db.select().from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const profileEmpty = ![bs?.aiNiche, bs?.aiAudience, bs?.aiVoice, bs?.aiRules, bs?.aiCta].some((v) => v?.trim());
  const remaining = Math.max(0, SUBSTACK_DAILY_LIMIT - (await articlesToday(c.brandId)));
  return (
    <div className="page">
      <PageHead back={{ href: '/admin/substack', label: 'Artigos do Substack' }} title="Gerar artigo" description="Escolha de onde o artigo nasce (uma ideia, um tema ou um material), o tipo de texto e o tamanho. A IA monta o esboço, você aprova, e ela escreve." />
      {profileEmpty && (
        <div className="notice info" style={{ marginBottom: 20 }}>
          Dica: descreva o tom de voz e o público da marca em <Link href="/admin/configuracoes"><b>Configurações → Identidade da marca para a IA</b></Link>. Os artigos usam isso para soar como a sua marca.
        </div>
      )}
      <Studio ideas={ideas} initialIdeaId={ideia && isUuid(ideia) ? ideia : ''} hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'} remaining={remaining} />
    </div>
  );
}
