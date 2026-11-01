import { PUBLICO_ID } from '@/lib/territory';
import type { TerritoryOption } from '@/lib/idea';

/** Qualquer território do mapa com qualquer persona: o rótulo avisa se a persona já enxerga o tema e se ele já foi traduzido para ela. */
export function TerritorySelect({ id, options, persona, value, onChange, empty, filterByPersona = false }: {
  id?: string; options: TerritoryOption[]; persona: string; value: string; onChange: (v: string) => void; empty: string; filterByPersona?: boolean;
}) {
  const real = persona && persona !== PUBLICO_ID ? persona : '';
  const list = filterByPersona && real ? options.filter((o) => o.personaIds.includes(real)) : options;
  const tag = (o: TerritoryOption) => (!real ? '' : o.translated.includes(real) ? ' · traduzido ✓' : o.personaIds.includes(real) ? '' : ' · sem ligação');
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={empty}>
      <option value="">{empty}</option>
      {list.map((o) => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.label}{tag(o)}</option>)}
    </select>
  );
}

/** Situação da dupla persona × território, em uma frase. */
export function pairStatus(o: TerritoryOption | undefined, persona: string): 'translated' | 'linked' | 'new' | null {
  if (!o || !persona || persona === PUBLICO_ID) return null;
  return o.translated.includes(persona) ? 'translated' : o.personaIds.includes(persona) ? 'linked' : 'new';
}
