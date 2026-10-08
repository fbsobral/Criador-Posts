import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { deleteTemplate } from '@/lib/actions';

export default async function TemplatesPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);
  const canDelete = (brandId: string | null) => (brandId === null ? c.isPlatformAdmin : c.isBrandAdmin);

  return (
    <>
      <div className="page-head"><h1>Templates</h1></div>
      <p className="muted">Templates globais ficam disponíveis para todas as marcas. Para criar um da sua marca, ajuste as cores dentro de um post e use “Salvar estilo como template”.</p>
      <div className="cards">
        {rows.map((t) => (
          <div className="card" key={t.id}>
            <div className="sw" style={{ background: t.style.theme.bg, color: t.style.theme.title }}>
              <b style={{ fontFamily: t.style.font }}>Aa</b><i style={{ background: t.style.theme.marker }} />
            </div>
            <div className="card-foot">
              <span>{t.name}</span>
              <span className="pill">{t.brandId === null ? 'Global' : 'Da marca'}</span>
            </div>
            {canDelete(t.brandId) && (
              <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><button className="btn small danger">Excluir</button></form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
