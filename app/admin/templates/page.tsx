import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { createTemplate, deleteTemplate } from '@/lib/actions';
import { EDITORS } from '@/lib/editors';

export default async function TemplatesPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);
  const canDelete = (brandId: string | null) => (brandId === null ? c.isPlatformAdmin : c.isBrandAdmin);

  return (
    <>
      <div className="page-head"><h1>Templates</h1></div>
      <p className="muted">Um template é o <b>formato do post</b>. Você escolhe um ao criar cada post em Posts.</p>
      <div className="cards">
        {rows.map((t) => (
          <div className="card" key={t.id}>
            <div className="card-foot"><b>{t.name}</b><span className="pill">{t.brandId === null ? 'Global' : 'Da marca'}</span></div>
            <p className="muted">{t.description || '—'}</p>
            <p className="muted">Editor: {EDITORS[t.editor as keyof typeof EDITORS]?.label ?? t.editor}</p>
            {canDelete(t.brandId) && (
              <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><button className="btn small danger">Excluir</button></form>
            )}
          </div>
        ))}
      </div>

      {c.isPlatformAdmin && (
        <>
          <h2 style={{ marginTop: 32 }}>Novo template <span className="pill">super-admin</span></h2>
          <form action={createTemplate} className="stack-form">
            <label>Nome<input name="name" required /></label>
            <label>Descrição<input name="description" /></label>
            <label>Editor
              <select name="editor">{Object.entries(EDITORS).map(([k, e]) => <option key={k} value={k}>{e.label}</option>)}</select>
            </label>
            <button className="btn primary">Criar template</button>
          </form>
        </>
      )}
    </>
  );
}
