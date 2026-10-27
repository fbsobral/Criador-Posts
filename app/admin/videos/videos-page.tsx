import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { timeAgo } from '@/lib/format';
import { normStage } from '@/lib/video';
import { IconSpark, IconTemplates, IconVideo } from '../../icons';
import { PageHead, EmptyState } from '../ui';
import { ModeToggle, VideosView, type VideosMode } from './videos-view';

export async function VideosPageContent({ mode }: { mode: VideosMode }) {
  const c = (await getCtx())!;
  const rows = await db.select().from(videoScripts).where(eq(videoScripts.brandId, c.brandId)).orderBy(desc(videoScripts.updatedAt)).limit(300);

  return (
    <div className="page">
      <PageHead
        title={mode === 'kanban' ? 'Esteira de produção' : 'Roteiros de vídeo'}
        description={mode === 'kanban' ? 'Acompanhe cada vídeo do rascunho até a publicação. Arraste os roteiros entre as etapas.' : 'Roteiros para Reels, TikTok e Shorts, escritos parte por parte. Acompanhe cada vídeo do rascunho até a publicação.'}
        actions={<>
          {rows.length > 0 && <ModeToggle mode={mode} />}
          <Link href="/admin/videos/formatos" className="btn"><IconTemplates /> Formatos</Link>
          <Link href="/admin/videos/gerar" className="btn primary"><IconSpark /> Gerar roteiros</Link>
        </>}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<IconVideo />} title="Nenhum roteiro ainda" action={<Link href="/admin/videos/gerar" className="btn primary"><IconSpark /> Gerar meus primeiros roteiros</Link>}>
          Cole um artigo, uma transcrição ou um texto longo, escolha o formato e a duração, e a IA sugere as ideias. Você aprova e ela escreve os roteiros.
        </EmptyState>
      ) : (
        <VideosView
          key={mode}
          mode={mode}
          rows={rows.map((s) => ({
            id: s.id, title: s.title, hook: s.data.parts[0]?.speech ?? '', formatName: s.formatName, seconds: s.seconds, platform: s.platform,
            status: normStage(s.status), ago: timeAgo(s.updatedAt), parts: s.data.parts.map((p) => ({ name: p.name, seconds: p.seconds })),
          }))}
        />
      )}
    </div>
  );
}
