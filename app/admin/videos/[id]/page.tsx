import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { normStage } from '@/lib/video';
import { IconBack } from '../../../icons';
import { ScriptEditor } from './script-editor';

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s] = await db.select().from(videoScripts).where(and(eq(videoScripts.id, id), eq(videoScripts.brandId, c.brandId)));
  if (!s) notFound();
  return (
    <div className="page">
      <Link href="/admin/videos" className="back"><IconBack /> Roteiros de vídeo</Link>
      <ScriptEditor
        id={s.id} initialTitle={s.title} initialStatus={normStage(s.status)} data={s.data}
        meta={{ formatName: s.formatName, seconds: s.seconds, platform: s.platform, angle: s.angle }}
      />
    </div>
  );
}
