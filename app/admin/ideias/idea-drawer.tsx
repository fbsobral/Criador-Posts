'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FIELD_HELP, type Idea, type TerritoryOption } from '@/lib/idea';
import { createIdea, updateIdea } from '@/lib/idea-actions';
import { PUBLICO_ID } from '@/lib/territory';

/** Criar ou editar uma ideia à mão. */
export function IdeaDrawer({ idea, personas, options, defaults, onClose }: {
  idea: Idea | null; personas: { id: string; name: string }[]; options: TerritoryOption[]; defaults: { persona: string; territory: string }; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [persona, setPersona] = useState(idea ? idea.personaId ?? PUBLICO_ID : defaults.persona || personas[0]?.id || PUBLICO_ID);
  const [territory, setTerritory] = useState(idea ? idea.territoryId ?? '' : defaults.territory);
  const [territoryText, setTerritoryText] = useState(idea?.territoryId ? '' : idea?.territory ?? '');
  const [pain, setPain] = useState(idea?.pain ?? '');
  const [guide, setGuide] = useState(idea?.guide ?? '');
  const [args, setArgs] = useState((idea?.args ?? []).join('\n'));
  const [cta, setCta] = useState(idea?.cta ?? '');
  const [err, setErr] = useState('');
  const terrOpts = options.filter((o) => o.personaId === persona);

  const save = () => start(async () => {
    const input = { personaId: persona === PUBLICO_ID ? null : persona, territoryId: territory || null, territory: territoryText, pain, guide, args: args.split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean), cta };
    const r = idea ? await updateIdea(idea.id, input) : await createIdea(input);
    if (r.error) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="pe-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="pe-drawer" role="dialog" aria-modal="true" aria-label={idea ? 'Editar ideia' : 'Nova ideia'}>
        <header>
          <h2>{idea ? 'Editar ideia' : 'Nova ideia'}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="pe-drawer-body">
          <div className="field">
            <label htmlFor="dp">Persona relacionada</label>
            <select id="dp" value={persona} onChange={(e) => { setPersona(e.target.value); setTerritory(''); }}>{[...personas, { id: PUBLICO_ID, name: 'Público geral' }].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <small className="muted">{FIELD_HELP.persona}</small>
          </div>
          <div className="field">
            <label htmlFor="dt">Território</label>
            <select id="dt" value={territory} onChange={(e) => setTerritory(e.target.value)}>
              <option value="">Sem território do mapa</option>
              {terrOpts.map((o) => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.label}</option>)}
            </select>
            {!territory && <input type="text" value={territoryText} onChange={(e) => setTerritoryText(e.target.value)} maxLength={200} placeholder="Ou escreva o tema à mão" style={{ marginTop: 6 }} />}
            <small className="muted">{FIELD_HELP.territory}</small>
          </div>
          <div className="field"><label htmlFor="dd">Dor (linguagem de rua)</label><textarea id="dd" rows={3} value={pain} onChange={(e) => setPain(e.target.value)} maxLength={400} placeholder="“Todo mês eu pago o aluguel e não sobra nada pra mim.”" /><small className="muted">{FIELD_HELP.pain}</small></div>
          <div className="field"><label htmlFor="dg">Guia (enquadramento progressista)</label><textarea id="dg" rows={3} value={guide} onChange={(e) => setGuide(e.target.value)} maxLength={600} placeholder="Cuidado e proteção: uma cidade que cuida de quem mora nela, como uma casa onde todo mundo cabe." /><small className="muted">{FIELD_HELP.guide}</small></div>
          <div className="field"><label htmlFor="da">Argumentos <span className="muted">(um por linha)</span></label><textarea id="da" rows={5} value={args} onChange={(e) => setArgs(e.target.value)} placeholder={'Um argumento por linha'} /><small className="muted">{FIELD_HELP.args}</small></div>
          <div className="field"><label htmlFor="dc">CTA indireta</label><textarea id="dc" rows={2} value={cta} onChange={(e) => setCta(e.target.value)} maxLength={300} placeholder="Manda pra quem está passando por isso." /><small className="muted">{FIELD_HELP.cta}</small></div>
          {err && <div className="notice err">{err}</div>}
        </div>
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={save} disabled={pending || !pain.trim()}>{pending ? 'Salvando…' : 'Salvar ideia'}</button>
        </footer>
      </aside>
    </div>
  );
}
