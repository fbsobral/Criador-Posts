import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { getBrandSettings, getCtx } from '@/lib/ctx';
import { saveSettings } from '@/lib/actions';

export default async function SettingsPage() {
  const c = (await getCtx())!;
  const s = (await getBrandSettings(c.brandId))!;
  const tpls = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);
  const current = tpls.find((t) => s.style && JSON.stringify(t.style) === JSON.stringify(s.style));
  const ro = !c.isBrandAdmin;

  return (
    <>
      <div className="page-head"><h1>Configurações</h1></div>
      <p className="muted">Padrões aplicados aos <b>novos</b> posts da marca {c.brandName}.{ro && ' Apenas admins da marca podem editar.'}</p>
      <form action={saveSettings} className="stack-form">
        <label>Nome<input name="displayName" defaultValue={s.displayName} disabled={ro} /></label>
        <label>@ usuário<input name="handle" defaultValue={s.handle} disabled={ro} /></label>
        <label>Tema (canto superior)<input name="topic" defaultValue={s.topic} disabled={ro} /></label>
        <label>Ano<input name="year" defaultValue={s.year} disabled={ro} /></label>
        <label>Template padrão
          <select name="templateId" defaultValue={current?.id ?? ''} disabled={ro}>
            <option value="">Original (padrão)</option>
            {tpls.map((t) => <option key={t.id} value={t.id}>{t.name}{t.brandId === null ? ' (global)' : ''}</option>)}
          </select>
        </label>
        {!ro && <button className="btn primary">Salvar</button>}
      </form>
    </>
  );
}
