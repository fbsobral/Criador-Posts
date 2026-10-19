import Link from 'next/link';
import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, videoFormats } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { VIDEO_DAILY_LIMIT, scriptsToday } from '@/lib/video-server';
import { PageHead } from '../../ui';
import { Wizard } from './wizard';

export const metadata = { title: 'Gerar roteiros' };

export default async function GerarVideosPage() {
  const c = (await getCtx())!;
  const [formats, [s], today] = await Promise.all([
    db.select().from(videoFormats).where(or(isNull(videoFormats.brandId), eq(videoFormats.brandId, c.brandId))).orderBy(videoFormats.name),
    db.select().from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    scriptsToday(c.brandId),
  ]);
  const profileEmpty = ![s?.aiNiche, s?.aiAudience, s?.aiVoice, s?.aiRules, s?.aiCta].some((v) => v?.trim());
  return (
    <div className="page">
      <PageHead
        back={{ href: '/admin/videos', label: 'Roteiros de vídeo' }}
        title="Gerar roteiros"
        description="Cole um conteúdo longo, escolha o formato e a duração. A IA sugere as ideias, você aprova, e ela escreve um roteiro para cada uma."
      />
      {profileEmpty && (
        <div className="notice info" style={{ marginBottom: 20 }}>
          Dica: descreva o tom de voz e o público da marca em <Link href="/admin/configuracoes"><b>Configurações → Identidade da marca para a IA</b></Link>. Os roteiros usam isso para soar como a sua marca.
        </div>
      )}
      <Wizard
        formats={formats.map((f) => ({ id: f.id, name: f.name, description: f.description, defaultSeconds: f.defaultSeconds, parts: f.parts, own: !!f.brandId }))}
        hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'}
        remaining={Math.max(0, VIDEO_DAILY_LIMIT - today)}
        canEditFormats={c.isBrandAdmin}
      />
    </div>
  );
}
