import Link from 'next/link';
import { cookies } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { timeAgo } from '@/lib/format';
import { normStage } from '@/lib/video';
import { IconSpark, IconTemplates, IconVideo } from '../../icons';
import { ModeToggle, VideosView, type VideosMode } from './videos-view';

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const c = (await getCtx())!;
  const { v } = await searchParams;
  const saved = (await cookies()).get('videos_view')?.value;
  const mode: VideosMode = (v ?? saved) === 'kanban' ? 'kanban' : 'lista';
  const rows = await db.select().from(videoScripts).where(eq(videoScripts.brandId, c.brandId)).orderBy(desc(videoScripts.updatedAt)).limit(300);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Roteiros de vídeo</h1>
          <p>Roteiros para Reels, TikTok e Shorts, escritos parte por parte. Acompanhe cada vídeo do rascunho até a publicação.</p>
        </div>
        <div className="row-actions">
          {rows.length > 0 && <ModeToggle mode={mode} />}
          <Link href="/admin/videos/formatos" className="btn"><IconTemplates /> Formatos</Link>
          <Link href="/admin/videos/gerar" className="btn primary"><IconSpark /> Gerar roteiros</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="vd-empty-ic"><IconVideo /></div>
          <h2>Nenhum roteiro ainda</h2>
          <p className="muted" style={{ maxWidth: 440, margin: '6px auto 18px' }}>Cole um artigo, uma transcrição ou um texto longo, escolha o formato e a duração, e a IA sugere as ideias. Você aprova e ela escreve os roteiros.</p>
          <Link href="/admin/videos/gerar" className="btn primary"><IconSpark /> Gerar meus primeiros roteiros</Link>
        </div>
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
