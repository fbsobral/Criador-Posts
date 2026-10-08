import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { createTemplate, deleteTemplate } from '@/lib/actions';
import { EDITORS } from '@/lib/editors';
import { IconPlus, IconTrash } from '../../icons';
import { TemplateArt } from '../template-art';

export default async function TemplatesPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);
  const canDelete = (brandId: string | null) => (brandId === null ? c.isPlatformAdmin : c.isBrandAdmin);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Templates</h1>
          <p>Um template é o <b>formato do post</b>. Você escolhe um ao criar cada post em Posts.</p>
        </div>
      </div>

      <div className="cards">
        {rows.map((t) => (
          <div className="card-surface tpl-card" key={t.id}>
            <div className="tpl-art"><TemplateArt editor={t.editor} /></div>
            <h3>{t.name}<span className={`pill ${t.brandId === null ? 'dark' : 'brand'}`}>{t.brandId === null ? 'Global' : 'Da marca'}</span></h3>
            <p>{t.description || 'Formato de post.'}</p>
            <p style={{ fontSize: 12 }}>Editor: {EDITORS[t.editor as keyof typeof EDITORS]?.label ?? t.editor}</p>
            {canDelete(t.brandId) && (
              <form action={deleteTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn small danger"><IconTrash /> Excluir</button>
              </form>
            )}
          </div>
        ))}
      </div>

      {c.isPlatformAdmin && (
        <>
          <div className="section-title"><h2>Novo template</h2><span className="pill dark">super-admin</span></div>
          <form action={createTemplate} className="card-surface form-card" style={{ maxWidth: 560 }}>
            <label className="field">Nome<input name="name" required /></label>
            <label className="field">Descrição<input name="description" /></label>
            <label className="field">Editor
              <select name="editor">{Object.entries(EDITORS).map(([k, e]) => <option key={k} value={k}>{e.label}</option>)}</select>
            </label>
            <div><button className="btn primary"><IconPlus /> Criar template</button></div>
          </form>
        </>
      )}
    </div>
  );
}
