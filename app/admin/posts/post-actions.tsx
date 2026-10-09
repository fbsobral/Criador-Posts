import { deletePost, duplicatePost, migratePost, renamePost } from '@/lib/actions';
import { ConvertButton } from './convert-button';
import { IconCopy, IconEdit, IconMove, IconTrash } from '../../icons';

export type Destination = { id: string; name: string };

/** Botões de ação de um post (renomear, migrar [super-admin], duplicar, excluir). Usado nos cards e na lista. */
export function PostActions({ id, title, destinations, editor, slides }: { id: string; title: string; destinations: Destination[]; editor?: string | null; slides?: number }) {
  const canConvert = (editor === 'carrossel' || editor === 'tweet') && !!process.env.ANTHROPIC_API_KEY;
  return (
    <>
      <details className="rename-pop">
        <summary className="btn small ghost" title="Renomear" aria-label="Renomear"><IconEdit /></summary>
        <form action={renamePost} className="card-surface rename-form">
          <input type="hidden" name="id" value={id} />
          <input name="title" defaultValue={title} maxLength={120} required aria-label="Novo título" />
          <button className="btn small primary">Salvar</button>
        </form>
      </details>
      {destinations.length > 0 && (
        <details className="rename-pop">
          <summary className="btn small ghost" title="Migrar para outra marca" aria-label="Migrar para outra marca"><IconMove /></summary>
          <form action={migratePost} className="card-surface rename-form migrate-form">
            <b>Migrar para outra marca</b>
            <input type="hidden" name="id" value={id} />
            <select name="destOrgId" required defaultValue="" aria-label="Marca de destino">
              <option value="" disabled>Escolha a marca…</option>
              {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <label className="mini-check"><input type="checkbox" name="applyIdentity" defaultChecked /> Aplicar nome, @ e foto da marca de destino</label>
            <small className="muted">O post sai desta marca e chega como rascunho.</small>
            <button className="btn small primary">Migrar</button>
          </form>
        </details>
      )}
      {canConvert && <ConvertButton id={id} editor={editor as 'carrossel' | 'tweet'} slides={slides ?? 0} />}
      <form action={duplicatePost}>
        <input type="hidden" name="id" value={id} />
        <button className="btn small ghost" title="Duplicar" aria-label="Duplicar"><IconCopy /></button>
      </form>
      <form action={deletePost}>
        <input type="hidden" name="id" value={id} />
        <button className="btn small ghost danger" title="Excluir" aria-label="Excluir"><IconTrash /></button>
      </form>
    </>
  );
}
