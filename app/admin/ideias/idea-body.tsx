import { IDEA_FIELDS, type IdeaFields } from '@/lib/idea';

const LABEL: Record<keyof IdeaFields, string> = { pain: 'Dor', impact: 'Impacto', cause: 'Causa', guide: 'Guia', args: 'Argumentos', gain: 'Ganho', desire: 'Desejo', cta: 'CTA' };
const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

function Section({ k, f }: { k: keyof IdeaFields; f: IdeaFields }) {
  if (!f[k]) return null;
  const items = k === 'args' ? lines(f[k]) : [];
  return (
    <div className="id-sec">
      <span>{LABEL[k]}</span>
      {k === 'args' && items.length > 1 ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className={k === 'pain' ? 'id-pain' : undefined}>{f[k]}</p>}
    </div>
  );
}

/** Mostra uma ideia: Dor, Guia e CTA sempre visíveis; o resto da história (impacto, causa, argumentos, ganho, desejo) abre sob demanda. Em `full`, mostra tudo. */
export function IdeaBody({ f, full = false }: { f: IdeaFields; full?: boolean }) {
  const more = (['impact', 'cause', 'args', 'gain', 'desire'] as const).filter((k) => f[k]);
  return (
    <>
      <Section k="pain" f={f} />
      {full ? <>{more.slice(0, 2).map((k) => <Section key={k} k={k} f={f} />)}<Section k="guide" f={f} />{more.slice(2).map((k) => <Section key={k} k={k} f={f} />)}</> : <Section k="guide" f={f} />}
      {!full && more.length > 0 && (
        <details className="id-more">
          <summary>Ver a história completa ({more.length})</summary>
          {(['impact', 'cause', 'args', 'gain', 'desire'] as const).map((k) => <Section key={k} k={k} f={f} />)}
        </details>
      )}
      <Section k="cta" f={f} />
    </>
  );
}

export const ideaText = (f: IdeaFields, persona: string, territory: string) =>
  `Persona: ${persona}\nTerritório: ${territory || '—'}\n\n${IDEA_FIELDS.map((x) => `${x.label.toUpperCase().replace(/ \(.*\)/, '')}\n${f[x.key]}`).join('\n\n')}`;
