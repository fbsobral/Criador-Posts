import Link from 'next/link';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, generationBatches, generationItems, templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { supportsAi } from '@/lib/ai/generate';
import { IMAGE_COST_USD, costUsd, fmtUsd } from '@/lib/ai/constants';
import { imageEnabled } from '@/lib/ai/image';
import { timeAgo } from '@/lib/format';
import { GenerateForm } from './generate-form';

export default async function GeneratePage() {
  const c = (await getCtx())!;
  const all = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);
  const formats = all.filter((t) => supportsAi(t.editor));
  const [s] = await db.select().from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const profileEmpty = ![s?.aiNiche, s?.aiAudience, s?.aiVoice, s?.aiRules, s?.aiCta, s?.aiExamples].some((v) => v?.trim());

  const batches = await db
    .select({
      b: generationBatches,
      total: sql<number>`count(${generationItems.id})::int`,
      done: sql<number>`count(*) filter (where ${generationItems.status} = 'done')::int`,
      failed: sql<number>`count(*) filter (where ${generationItems.status} = 'error')::int`,
      inTok: sql<number>`coalesce(sum(${generationItems.inputTokens}), 0)::int`,
      imgs: sql<number>`coalesce(sum(${generationItems.imageCount}), 0)::int`,
      outTok: sql<number>`coalesce(sum(${generationItems.outputTokens}), 0)::int`,
      first: sql<string>`min(left(${generationItems.brief}, 90))`,
    })
    .from(generationBatches)
    .leftJoin(generationItems, eq(generationItems.batchId, generationBatches.id))
    .where(eq(generationBatches.brandId, c.brandId))
    .groupBy(generationBatches.id)
    .orderBy(desc(generationBatches.createdAt))
    .limit(12);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gerar com IA</h1>
          <p>Crie vários posts de uma vez. Eles chegam como <b>rascunhos</b> para você revisar e ajustar no editor.</p>
        </div>
      </div>

      {profileEmpty && (
        <div className="notice info" style={{ marginBottom: 20 }}>
          Dica: descreva o tom de voz e o público da marca em <Link href="/admin/configuracoes"><b>Configurações → Identidade da marca para a IA</b></Link>. É isso que deixa os posts com a cara da marca.
        </div>
      )}

      <GenerateForm
        formats={formats.map((t) => ({ id: t.id, name: t.name, description: t.description, editor: t.editor }))}
        hasKey={!!process.env.ANTHROPIC_API_KEY}
        hasImageKey={imageEnabled()}
      />

      {batches.length > 0 && (
        <>
          <div className="section-title"><h2>Lotes recentes</h2></div>
          <div className="card-surface table-card">
            <table>
              <thead><tr><th>Lote</th><th className="hide-s">Modo</th><th>Progresso</th><th className="hide-s">Custo</th><th className="hide-s">Quando</th></tr></thead>
              <tbody>
                {batches.map(({ b, total, done, failed, inTok, outTok, imgs, first }) => (
                  <tr key={b.id}>
                    <td><Link href={`/admin/gerar/${b.id}`}><b>{first || 'Lote'}</b>{total > 1 && <span className="muted"> + {total - 1}</span>}</Link></td>
                    <td className="hide-s muted">{b.mode === 'roteiro' ? 'Roteiros' : 'Temas'}</td>
                    <td>
                      <span className={`pill ${done === total ? 'published' : 'draft'}`}>{done}/{total}</span>
                      {failed > 0 && <span className="pill" style={{ marginLeft: 6, background: '#fdecea', color: 'var(--danger)' }}>{failed} com erro</span>}
                    </td>
                    <td className="hide-s muted">{fmtUsd(costUsd(inTok, outTok) + imgs * IMAGE_COST_USD)}</td>
                    <td className="hide-s muted">{timeAgo(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
