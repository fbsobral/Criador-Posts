import { PUBLICO_ID } from '@/lib/territory';
import type { TerritoryOption } from '@/lib/idea';

/** Qualquer território do mapa com qualquer persona. Com persona escolhida, os territórios vêm agrupados pela situação dela (traduzidos, ligados, outros); sem persona, agrupados pelo território-raiz. O rótulo sempre mostra o caminho completo. */
export function TerritorySelect({ id, options, persona, value, onChange, empty, filterByPersona = false }: {
  id?: string; options: TerritoryOption[]; persona: string; value: string; onChange: (v: string) => void; empty: string; filterByPersona?: boolean;
}) {
  const real = persona && persona !== PUBLICO_ID ? persona : '';
  const list = filterByPersona && real ? options.filter((o) => o.personaIds.includes(real)) : options;
  const opt = (o: TerritoryOption, label: string) => <option key={o.id} value={o.id}>{label}</option>;

  let body: React.ReactNode;
  if (real) {
    const translated = list.filter((o) => o.translated.includes(real));
    const linked = list.filter((o) => !o.translated.includes(real) && o.personaIds.includes(real));
    const others = list.filter((o) => !o.personaIds.includes(real));
    body = (
      <>
        {translated.length > 0 && <optgroup label={`Já traduzidos para esta persona (${translated.length})`}>{translated.map((o) => opt(o, `✓ ${o.path}`))}</optgroup>}
        {linked.length > 0 && <optgroup label={`Ligados a esta persona (${linked.length})`}>{linked.map((o) => opt(o, o.path))}</optgroup>}
        {others.length > 0 && <optgroup label={`Outros territórios do mapa (${others.length})`}>{others.map((o) => opt(o, o.path))}</optgroup>}
      </>
    );
  } else {
    // sem persona: um grupo por território-raiz (o raiz sem subtemas fica solto)
    const groups: { root: TerritoryOption; items: TerritoryOption[] }[] = [];
    for (const o of list) { if (o.depth === 0 || !groups.length) groups.push({ root: o, items: [] }); else groups[groups.length - 1].items.push(o); }
    body = groups.map((g) => (g.items.length === 0
      ? opt(g.root, g.root.path)
      : <optgroup key={g.root.id} label={g.root.label}>{[opt(g.root, `${g.root.label} (tema geral)`), ...g.items.map((o) => opt(o, o.path.split(' › ').slice(1).join(' › ')))]}</optgroup>));
  }
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={empty}>
      <option value="">{empty}</option>
      {body}
    </select>
  );
}

/** Situação da dupla persona × território, em uma frase. */
export function pairStatus(o: TerritoryOption | undefined, persona: string): 'translated' | 'linked' | 'new' | null {
  if (!o || !persona || persona === PUBLICO_ID) return null;
  return o.translated.includes(persona) ? 'translated' : o.personaIds.includes(persona) ? 'linked' : 'new';
}
