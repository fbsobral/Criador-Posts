'use client';

import { useState } from 'react';
import { levelOf, type PriorityConfig } from '@/lib/priority';
import { PriorityModal } from './priority-modal';

/** Botão "Prioridades" (com a contagem por faixa) que abre critérios, faixas e o reclassificar tudo. */
export function PriorityBar({ config, scores, total, canEdit, hasKey }: { config: PriorityConfig; scores: (number | null)[]; total: number; canEdit: boolean; hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const levels = [...config.levels].sort((a, b) => b.min - a.min);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} title="Critérios, faixas e reclassificação dos scores">
        Prioridades{!config.criteria.length && <span className="pr-warn">definir</span>}
        <span className="pr-dots">{levels.map((l) => <span key={l.id} className="pr-dot" style={{ ['--c' as string]: l.color }} title={l.name}><i />{scores.filter((s) => levelOf(s, config.levels)?.id === l.id).length}</span>)}</span>
      </button>
      {open && <PriorityModal config={config} canEdit={canEdit} onClose={() => setOpen(false)} total={total} unscored={scores.filter((s) => !s).length} hasKey={hasKey} />}
    </>
  );
}
