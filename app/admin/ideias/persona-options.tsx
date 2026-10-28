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
