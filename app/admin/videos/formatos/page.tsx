import Link from 'next/link';
import { eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { videoFormats } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { allocate, fmtSecs } from '@/lib/video';
import { IconBack, IconPlus } from '../../../icons';
import { PartsBar } from '../parts-bar';
import { FormatActions } from './format-actions';

export default async function FormatsPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(videoFormats).where(or(isNull(videoFormats.brandId), eq(videoFormats.brandId, c.brandId))).orderBy(videoFormats.name);
  const mine = rows.filter((f) => f.brandId), globals = rows.filter((f) => !f.brandId);

  const card = (f: (typeof rows)[number]) => {
    const secs = allocate(f.parts, f.defaultSeconds);
    return (
      <div key={f.id} className="card-surface vd-fmt">
        <div className="vd-fmt-top"><b>{f.name}</b><span className={`pill ${f.brandId ? 'published' : ''}`}>{f.brandId ? 'Da marca' : 'Global'}</span></div>
        <p className="muted">{f.description || 'Sem descrição.'}</p>
        <PartsBar parts={f.parts.map((p, i) => ({ name: p.name, seconds: secs[i] }))} />
        <div className="vd-meta"><span>{f.parts.length} partes</span><i>·</i><span>{fmtSecs(f.defaultSeconds)} por padrão</span></div>
        <FormatActions id={f.id} own={!!f.brandId} canEdit={c.isBrandAdmin} />
      </div>
    );
  };

  return (
    <div className="page">
      <Link href="/admin/videos" className="back"><IconBack /> Roteiros de vídeo</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1>Formatos de vídeo</h1>
          <p>Cada formato divide o vídeo em <b>partes</b>, e cada parte tem as suas instruções. É assim que a IA sabe o que escrever em cada trecho.</p>
        </div>
        {c.isBrandAdmin && <Link href="/admin/videos/formatos/novo" className="btn primary"><IconPlus /> Novo formato</Link>}
      </div>

      <div className="section-title" style={{ marginTop: 8 }}><h2>Da sua marca</h2></div>
      {mine.length ? <div className="vd-fmts">{mine.map(card)}</div> : (
        <div className="empty"><b>Nenhum formato próprio ainda</b>Crie um do zero ou duplique um dos formatos prontos abaixo para adaptar ao seu jeito.</div>
      )}

      <div className="section-title"><h2>Formatos prontos</h2></div>
      <div className="vd-fmts">{globals.map(card)}</div>
    </div>
  );
}
