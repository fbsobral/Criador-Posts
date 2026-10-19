import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoFormats } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { PageHead } from '../../../ui';
import { FormatEditor } from './format-editor';

export default async function FormatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!c.isBrandAdmin) return <div className="page"><div className="notice warn">Apenas administradores da marca editam formatos.</div></div>;
  let initial = { id: undefined as string | undefined, name: '', description: '', defaultSeconds: 45, parts: [
    { id: 'p1', name: 'Gancho', instruction: 'Pare o scroll em até 3 segundos com uma pergunta, uma contradição ou uma promessa específica.', percent: 20 },
    { id: 'p2', name: 'Desenvolvimento', instruction: '', percent: 60 },
    { id: 'p3', name: 'CTA', instruction: 'Peça uma única ação e diga o motivo.', percent: 20 },
  ] };
  if (id !== 'novo') {
    const [f] = await db.select().from(videoFormats).where(and(eq(videoFormats.id, id), eq(videoFormats.brandId, c.brandId)));
    if (!f) notFound();
    initial = { id: f.id, name: f.name, description: f.description, defaultSeconds: f.defaultSeconds, parts: f.parts };
  }
  return (
    <div className="page">
      <PageHead
        back={{ href: '/admin/videos/formatos', label: 'Formatos de vídeo' }}
        title={initial.id ? 'Editar formato' : 'Novo formato'}
        description="Monte o vídeo em partes e escreva o que a IA deve fazer em cada uma. Quanto mais específica a instrução, melhor o roteiro."
      />
      <FormatEditor initial={initial} />
    </div>
  );
}
