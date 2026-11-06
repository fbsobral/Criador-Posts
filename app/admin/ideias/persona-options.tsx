import { PUBLICO_ID } from '@/lib/territory';

export type PersonaOpt = { id: string; name: string; group?: string };

/** <option>s das personas da organização, agrupadas pelos grupos delas (e o "Público geral"). */
export function PersonaOptions({ personas, publico = true }: { personas: PersonaOpt[]; publico?: boolean }) {
  const groups = [...new Set(personas.map((p) => p.group || 'Sem grupo'))];
  return (
    <>
      {groups.length > 1
        ? groups.map((g) => <optgroup key={g} label={g}>{personas.filter((p) => (p.group || 'Sem grupo') === g).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)
        : personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      {publico && <option value={PUBLICO_ID}>Público geral (sem persona)</option>}
    </>
  );
}

/** Público amplo: além da persona principal, a ideia também fala com estas (opcional). */
export function ExtraPersonas({ personas, primary, value, onChange }: { personas: PersonaOpt[]; primary: string; value: string[]; onChange: (v: string[]) => void }) {
  const others = personas.filter((p) => p.id !== primary);
  if (primary === PUBLICO_ID || !others.length) return null;
  const on = value.filter((id) => id !== primary);
  return (
    <div className="field">
      <label>Falar também com <span className="muted">(opcional)</span></label>
      <div className="vd-chips">
        {others.map((p) => <button key={p.id} type="button" aria-pressed={on.includes(p.id)} className={`vd-chip${on.includes(p.id) ? ' on' : ''}`} onClick={() => onChange(on.includes(p.id) ? on.filter((x) => x !== p.id) : [...on, p.id])}>{p.name}</button>)}
      </div>
      <small className="muted">{on.length ? 'Público amplo: o conteúdo fala com o grupo pelo que as personas têm em comum. Fica mais abrangente e um pouco menos pessoal.' : 'Marque outras personas para uma ideia mais abrangente, que fale com todas de uma vez.'}</small>
    </div>
  );
}

/** A lista final de personas: a principal primeiro e as extras depois (vazia = público geral). */
export const personaList = (primary: string, extra: string[]) => (primary === PUBLICO_ID ? [] : [primary, ...extra.filter((x) => x !== primary)]);
