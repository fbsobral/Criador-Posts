import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { colorPalettes } from '@/db/schema';
import { getBrandSettings, getCtx } from '@/lib/ctx';
import { saveSettings } from '@/lib/actions';
import { GLOBAL_PRESETS } from '@/lib/themes';
import { PostPreview } from '../post-preview';

export default async function SettingsPage() {
  const c = (await getCtx())!;
  const s = (await getBrandSettings(c.brandId))!;
  const saved = await db.select().from(colorPalettes).where(and(eq(colorPalettes.brandId, c.brandId), eq(colorPalettes.editor, 'carrossel'))).orderBy(colorPalettes.name);
  const same = (t: unknown) => !!s.style && JSON.stringify(t) === JSON.stringify(s.style.theme);
  const savedMatch = saved.find((p) => same(p.theme));
  const current = savedMatch ? `p:${savedMatch.id}` : (GLOBAL_PRESETS.find((p) => same(p.theme))?.name ?? 'Original');
  const ro = !c.isBrandAdmin;

  const options = [
    ...GLOBAL_PRESETS.map((p) => ({ value: p.name, label: p.name, theme: p.theme })),
    ...saved.map((p) => ({ value: `p:${p.id}`, label: p.name, theme: p.theme })),
  ];
  const active = options.find((o) => o.value === current)?.theme ?? GLOBAL_PRESETS[0].theme;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Padrões aplicados aos <b>novos</b> posts de {c.brandName}.{ro && ' Apenas administradores da marca podem editar.'}</p>
        </div>
      </div>

      <div className="settings">
        <form action={saveSettings} className="card-surface form-card">
          <h2>Perfil e cabeçalho</h2>
          <div className="two">
            <label className="field">Nome<input name="displayName" defaultValue={s.displayName} disabled={ro} /></label>
            <label className="field">Tema (acima do perfil)<input name="topic" defaultValue={s.topic} disabled={ro} /></label>
            <label className="field">Ano<input name="year" defaultValue={s.year} disabled={ro} /></label>
          </div>

          <h2 style={{ marginTop: 6 }}>Contas por rede</h2>
          <p className="muted" style={{ marginTop: -10 }}>O @ de cada perfil. Na hora de baixar um post, você escolhe qual conta usar, ou baixa todas de uma vez.</p>
          <div className="two">
            <label className="field">Instagram<input name="instagram" defaultValue={s.instagram} disabled={ro} placeholder="@suamarca" /></label>
            <label className="field">TikTok<input name="tiktok" defaultValue={s.tiktok} disabled={ro} placeholder="@suamarca" /></label>
            <label className="field">X (Twitter)<input name="x" defaultValue={s.x} disabled={ro} placeholder="@suamarca" /></label>
          </div>

          <h2 style={{ marginTop: 6 }}>Cores padrão</h2>
          <div className="swatches">
            {options.map((o) => (
              <label className="sw-opt" key={o.value}>
                <input type="radio" name="colors" value={o.value} defaultChecked={o.value === current} disabled={ro} />
                <span className="sw" style={{ background: o.theme.bg, color: o.theme.title }}>Aa<i style={{ background: o.theme.marker }} /></span>
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {!ro && <div><button className="btn primary">Salvar alterações</button></div>}
        </form>

        <aside className="card-surface sticky-preview">
          <h2>Prévia</h2>
          <p className="muted">Como um novo post começa.</p>
          <div className="pvbox">
            <PostPreview editor="carrossel" theme={active} colors={null} text={`<h2>${s.topic || 'Título do seu post'}</h2><p>${s.displayName} ${s.instagram || s.tiktok || s.x}</p>`} />
          </div>
        </aside>
      </div>
    </div>
  );
}
