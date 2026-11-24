'use client';

/** Seleção de várias personas, ou de grupos inteiros de personas (um clique no grupo marca todas). Nenhuma marcada = público geral. */
export type PickPersona = { id: string; name: string; groupId: string | null };
export type PickGroup = { id: string; name: string };

export function PersonaPicker({ personas, groups, value, onChange, max = 10, disabled = false }: {
  personas: PickPersona[]; groups: PickGroup[]; value: string[]; onChange: (v: string[]) => void; max?: number; disabled?: boolean;
}) {
  if (!personas.length) return <small className="muted">Você ainda não tem personas. <a href="/admin/personas" className="vd-link">Criar personas →</a> (sem persona, o vídeo fala com o público geral da marca).</small>;
  const sel = new Set(value);
  const members = (g: PickGroup) => personas.filter((p) => p.groupId === g.id);
  const toggle = (id: string) => onChange(sel.has(id) ? value.filter((x) => x !== id) : value.length >= max ? value : [...value, id]);
  const toggleGroup = (g: PickGroup) => {
    const ids = members(g).map((p) => p.id);
    const all = ids.every((id) => sel.has(id));
    onChange(all ? value.filter((x) => !ids.includes(x)) : [...value, ...ids.filter((id) => !sel.has(id))].slice(0, max));
  };
  const names = value.map((id) => personas.find((p) => p.id === id)?.name).filter(Boolean);
  return (
    <div className="pk">
      {groups.some((g) => members(g).length > 0) && (
        <div className="vd-chips" role="group" aria-label="Grupos de personas">
          {groups.filter((g) => members(g).length > 0).map((g) => {
            const n = members(g).filter((p) => sel.has(p.id)).length, total = members(g).length;
            return <button key={g.id} type="button" disabled={disabled} className={`vd-chip pk-group${n === total ? ' on' : n > 0 ? ' half' : ''}`} aria-pressed={n === total} onClick={() => toggleGroup(g)} title="Marca ou desmarca todas as personas do grupo">{g.name} · {n > 0 && n < total ? `${n}/${total}` : total}</button>;
          })}
        </div>
      )}
      <div className="vd-chips" role="group" aria-label="Personas">
        {personas.map((p) => <button key={p.id} type="button" disabled={disabled} className={`vd-chip${sel.has(p.id) ? ' on' : ''}`} aria-pressed={sel.has(p.id)} onClick={() => toggle(p.id)}>{p.name}</button>)}
      </div>
      <small className="muted">{names.length ? `O vídeo fala com: ${names.join(', ')}${value.length >= max ? ` (máximo de ${max})` : ''}.` : 'Nenhuma marcada: o vídeo fala com o público geral da marca.'}</small>
    </div>
  );
}
