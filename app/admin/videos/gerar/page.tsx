import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { VIDEO_DAILY_LIMIT, scriptsToday } from '@/lib/video-server';
import { PageHead } from '../../ui';
import { Wizard } from './wizard';

export const metadata = { title: 'Gerar roteiros' };

export default async function GerarVideosPage() {
  const c = (await getCtx())!;
  const [[s], today] = await Promise.all([
    db.select().from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    scriptsToday(c.brandId),
  ]);
  const profileEmpty = ![s?.aiNiche, s?.aiAudience, s?.aiVoice, s?.aiRules, s?.aiCta].some((v) => v?.trim());
  return (
    <div className="page">
      <PageHead
        back={{ href: '/admin/videos', label: 'Roteiros de vídeo' }}
        title="Gerar roteiro"
        description="Diga sobre o que é o vídeo e a duração. A IA escreve o roteiro pronto para gravar, no tom da sua marca."
      />
      {profileEmpty && (
        <div className="notice info" style={{ marginBottom: 20 }}>
          Dica: descreva o tom de voz e o público da marca em <Link href="/admin/configuracoes"><b>Configurações → Identidade da marca para a IA</b></Link>. Os roteiros usam isso para soar como a sua marca.
        </div>
      )}
      <Wizard
        hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'}
        remaining={Math.max(0, VIDEO_DAILY_LIMIT - today)}
      />
    </div>
  );
}
