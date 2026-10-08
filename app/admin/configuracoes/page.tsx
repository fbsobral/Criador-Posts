import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { colorPalettes } from '@/db/schema';
import { getBrandSettings, getCtx } from '@/lib/ctx';
import { saveSettings } from '@/lib/actions';
import { GLOBAL_PRESETS } from '@/lib/themes';

export default async function SettingsPage() {
  const c = (await getCtx())!;
  const s = (await getBrandSettings(c.brandId))!;
  const saved = await db.select().from(colorPalettes).where(eq(colorPalettes.brandId, c.brandId)).orderBy(colorPalettes.name);
  const same = (t: unknown) => !!s.style && JSON.stringify(t) === JSON.stringify(s.style.theme);
  const current = saved.find((p) => same(p.theme))?.id
    ? `p:${saved.find((p) => same(p.theme))!.id}`
    : (GLOBAL_PRESETS.find((p) => same(p.theme))?.name ?? 'Original');
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
        <label>Cores padrão
          <select name="colors" defaultValue={current} disabled={ro}>
            <optgroup label="Temas prontos">
              {GLOBAL_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </optgroup>
            {saved.length > 0 && (
              <optgroup label="Cores salvas">
                {saved.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        {!ro && <button className="btn primary">Salvar</button>}
      </form>
    </>
  );
}
