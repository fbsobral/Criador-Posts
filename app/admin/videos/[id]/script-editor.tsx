'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { actionErrorMessage } from '@/lib/action-error';
import { deleteScript, duplicateScript, saveScript } from '@/lib/video-actions';
import { MAX_PARTS, MAX_PART_SECONDS, MAX_SECONDS, MIN_PART_SECONDS, STAGES, countWords, fmtSecs, reconcileParts, scriptToText, speakSeconds, speechToText, stageOf, totalSeconds, wordsFor, type ScriptData, type Stage } from '@/lib/video';
import { IconCopy, IconPlay, IconSpark, IconTrash } from '../../../icons';
import { wordDiff } from '@/lib/diff';

type Meta = { formatName: string; seconds: number; platform: string; angle: string };
type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export function ScriptEditor({ id, initialTitle, initialStatus, data: initial, meta, hasKey = true }: { id: string; initialTitle: string; initialStatus: Stage; data: ScriptData; meta: Meta; hasKey?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [data, setData] = useState<ScriptData>(initial);
  const [save, setSave] = useState<SaveState>('saved');
  const [saveMsg, setSaveMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedSpeech, setCopiedSpeech] = useState(false);
  const [prompter, setPrompter] = useState(false);
  // refinar com IA: pedir → comparar → aplicar (com opção de desfazer, porque o editor salva sozinho)
  const [refine, setRefine] = useState(false);
  const [scope, setScope] = useState<number | null>(null);
  const [fb, setFb] = useState('');
  const [firstFb, setFirstFb] = useState('');
  const [fb2, setFb2] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [tot, setTot] = useState<number | null>(null); // duração total pedida no refino do roteiro inteiro (null = a atual)
  const [sugg, setSugg] = useState<{ title: string; data: ScriptData; note: string } | null>(null);
  const [undo, setUndo] = useState<{ title: string; data: ScriptData } | null>(null);
  const first = useRef(true);
  const latest = useRef({ title, status, data });
  latest.current = { title, status, data };

  // histórico de Desfazer / Refazer do documento inteiro (título e blocos). Digitação em sequência vira um passo só.
  type Snap = { title: string; data: ScriptData };
  const hist = useRef<{ past: Snap[]; future: Snap[]; last: Snap; at: number; skip: boolean }>({ past: [], future: [], last: { title: initialTitle, data: initial }, at: 0, skip: false });
  const [hv, setHv] = useState(0); // só para redesenhar os botões
  useEffect(() => {
    const h = hist.current;
    if (h.skip) { h.skip = false; h.last = { title, data }; return; }
    if (h.last.title === title && h.last.data === data) return;
    const now = Date.now();
    if (now - h.at > 900) { h.past.push(h.last); if (h.past.length > 100) h.past.shift(); }
    h.future = []; h.last = { title, data }; h.at = now; setHv((x) => x + 1);
  }, [title, data]);
  const stepHist = (dir: 'back' | 'fwd') => {
    const h = hist.current;
    const from = dir === 'back' ? h.past : h.future, to = dir === 'back' ? h.future : h.past;
    const s = from.pop(); if (!s) return;
    to.push(h.last); h.skip = true; h.at = 0;
    setTitle(s.title); setData(s.data); setPr(null); setHv((x) => x + 1);
  };
  const canUndo = hist.current.past.length > 0, canRedo = hist.current.future.length > 0; void hv;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); stepHist('back'); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); stepHist('fwd'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const flush = useCallback(async () => {
    setSave('saving');
    try { const r = await saveScript({ id, ...latest.current }); setSave(r.error ? 'error' : 'saved'); setSaveMsg(r.error ?? ''); } catch (e) { setSave('error'); setSaveMsg(actionErrorMessage(e)); }
  }, [id]);
  // aplicar uma sugestão da IA salva na hora, sem esperar o salvamento automático
  const saveNow = useCallback(async (t: string, d: ScriptData) => {
    setSave('saving');
    try { const r = await saveScript({ id, title: t, status: latest.current.status, data: d }); setSave(r.error ? 'error' : 'saved'); setSaveMsg(r.error ?? ''); } catch (e) { setSave('error'); setSaveMsg(actionErrorMessage(e)); }
  }, [id]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSave('dirty');
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [title, status, data, flush]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save]);

  const setPart = (i: number, patch: Partial<ScriptData['parts'][number]>) => setData((d) => ({ ...d, parts: d.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  // o roteiro é uma página de texto único: cada parágrafo é um trecho (ver Doc). Tela, visual e tempo de cada trecho seguem junto, mesmo quando se divide ou junta parágrafos.
  const [caretIdx, setCaretIdx] = useState<number | null>(null); // parágrafo onde está o cursor
  const [sel, setSel] = useState<{ i: number; text: string; x: number; y: number } | null>(null); // trecho selecionado
  const [showNotes, setShowNotes] = useState(false);
  const texts = data.parts.map((p) => p.speech);
  const onTexts = useCallback((next: string[]) => setData((d) => ({ ...d, parts: reconcileParts(d.parts, next) })), []);
  const openPara = (i: number, quote?: string) => {
    const p = data.parts[i]; if (!p) return;
    setPr({ i, fb: quote ? `Reescreva SÓ este trecho, mantendo o resto igual: “${quote}”. O que mudar: ` : '', sec: p.seconds, busy: false, err: '', sugg: null, note: '' });
    setSel(null);
  };
  const nParts = data.parts.length;
  useEffect(() => { setPr(null); }, [nParts]); // dividir ou juntar parágrafos muda os números: fecha o painel de refino aberto
  const spoken = data.parts.reduce((a, p) => a + speakSeconds(p.speech), 0);
  const total = totalSeconds(data) || meta.seconds; // o vídeo dura a soma dos blocos
  const ratio = spoken / total;
  const durChanged = scope === null && tot !== null && tot !== total;
  const timing = ratio > 1.12 ? 'over' : ratio < 0.7 ? 'under' : 'ok';
  const words = data.parts.reduce((a, p) => a + countWords(p.speech), 0);

  const CHIPS = ['Mais fluido e explicativo', 'Mais curto', 'Gancho mais forte', 'Fala mais natural', 'Visual mais simples de gravar', 'CTA mais suave'];
  async function askRefine(feedback: string, previous?: { title: string; data: ScriptData }) {
    setRbusy(true); setRerr('');
    try {
      const r = await fetch('/api/videos/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, title, current: data, feedback, scope, previous, totalSeconds: scope === null && tot !== null && tot !== total ? tot : undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar o roteiro.');
      setSugg(j); setFb2('');
    } catch (e) { setRerr(e instanceof Error ? e.message : 'Erro inesperado.'); } finally { setRbusy(false); }
  }
  // refinar com IA só esta parte (botão em cada bloco): pede, compara antes/depois e aplica só nesta parte (dá para desfazer)
  type PartRefine = { i: number; fb: string; sec: number; busy: boolean; err: string; sugg: { speech: string; onScreen: string; visual: string; seconds: number } | null; note: string };
  const [pr, setPr] = useState<PartRefine | null>(null);
  const PCHIPS = ['Mais explicativo', 'Mais fluido', 'Mais curto', 'Fala mais natural', 'Mais forte', 'Visual mais simples de gravar'];
  async function askPart() {
    if (!pr) return;
    const i = pr.i, prev = pr.sugg;
    setPr({ ...pr, busy: true, err: '' });
    try {
      const previous = prev ? { title, data: { ...data, parts: data.parts.map((p, k) => (k === i ? { ...p, ...prev } : p)) } } : undefined;
      const r = await fetch('/api/videos/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, title, current: data, feedback: pr.fb.trim(), scope: i, previous }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar esta parte.');
      const np = (j.data as ScriptData).parts[i];
      setPr((x) => (x && x.i === i ? { ...x, busy: false, sugg: { speech: np?.speech ?? '', onScreen: np?.onScreen ?? '', visual: np?.visual ?? '', seconds: np?.seconds ?? x.sec }, note: j.note ?? '' } : x));
    } catch (e) { setPr((x) => (x ? { ...x, busy: false, err: e instanceof Error ? e.message : 'Erro inesperado.' } : x)); }
  }
  const partChanges = (i: number) => {
    if (!pr?.sugg || pr.i !== i) return [] as { label: string; before: string; after: string }[];
    const c = data.parts[i], n = pr.sugg;
    return ([['Duração', `${c.seconds} s`, `${n.seconds} s`], ['Fala', c.speech, n.speech], ['Texto na tela', c.onScreen, n.onScreen], ['Visual', c.visual, n.visual]] as const).filter(([, b, a]) => a.trim() !== b.trim()).map(([label, before, after]) => ({ label, before, after }));
  };
  const applyPart = () => {
    if (!pr?.sugg) return;
    const i = pr.i, n = pr.sugg;
    const nd = { ...data, parts: data.parts.map((p, k) => (k === i ? { ...p, speech: n.speech, onScreen: n.onScreen, visual: n.visual, seconds: n.seconds } : p)) };
    setUndo({ title, data }); setData(nd); saveNow(title, nd);
    setPr(null);
  };
  // refinar com IA só a legenda e as hashtags (botão no bloco da legenda)
  type CapRefine = { fb: string; busy: boolean; err: string; sugg: { caption: string; hashtags: string[] } | null; note: string };
  const [cr, setCr] = useState<CapRefine | null>(null);
  const CCHIPS = ['Mais curta', 'Gancho mais forte na 1ª linha', 'Tom mais natural', 'Menos hashtags'];
  const tagText = (h: string[]) => h.map((x) => `#${x}`).join(' ');
  async function askCaption() {
    if (!cr) return;
    const prev = cr.sugg;
    setCr({ ...cr, busy: true, err: '' });
    try {
      const previous = prev ? { title, data: { ...data, caption: prev.caption, hashtags: prev.hashtags } } : undefined;
      const r = await fetch('/api/videos/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, title, current: data, feedback: cr.fb, scope: 'caption', previous }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível refinar a legenda.');
      const d = j.data as ScriptData;
      setCr((x) => (x ? { ...x, busy: false, sugg: { caption: d.caption ?? '', hashtags: d.hashtags ?? [] }, note: j.note ?? '' } : x));
    } catch (e) { setCr((x) => (x ? { ...x, busy: false, err: e instanceof Error ? e.message : 'Erro inesperado.' } : x)); }
  }
  const capChanged = !!cr?.sugg && (cr.sugg.caption.trim() !== data.caption.trim() || tagText(cr.sugg.hashtags) !== tagText(data.hashtags));
  const applyCaption = () => {
    if (!cr?.sugg) return;
    const nd = { ...data, caption: cr.sugg.caption, hashtags: cr.sugg.hashtags };
    setUndo({ title, data }); setData(nd); saveNow(title, nd); setCr(null);
  };
  const changes = (() => {
    if (!sugg) return [] as { label: string; before: string; after: string }[];
    const out: { label: string; before: string; after: string }[] = [];
    if (sugg.title.trim() !== title.trim()) out.push({ label: 'Título', before: title, after: sugg.title });
    sugg.data.parts.forEach((p, k) => {
      const c = data.parts[k];
      if (p.speech.trim() !== c.speech.trim()) out.push({ label: `${k + 1}. ${p.name} · Fala`, before: c.speech, after: p.speech });
      if (p.onScreen.trim() !== c.onScreen.trim()) out.push({ label: `${k + 1}. ${p.name} · Texto na tela`, before: c.onScreen, after: p.onScreen });
      if (p.visual.trim() !== c.visual.trim()) out.push({ label: `${k + 1}. ${p.name} · Visual`, before: c.visual, after: p.visual });
    });
    if (sugg.data.caption.trim() !== data.caption.trim()) out.push({ label: 'Legenda', before: data.caption, after: sugg.data.caption });
    if (sugg.data.hashtags.join(' ') !== data.hashtags.join(' ')) out.push({ label: 'Hashtags', before: data.hashtags.map((h) => `#${h}`).join(' '), after: sugg.data.hashtags.map((h) => `#${h}`).join(' ') });
    return out;
  })();
  const applyRefined = () => {
    if (!sugg) return;
    setUndo({ title, data }); setTitle(sugg.title); setData(sugg.data); saveNow(sugg.title, sugg.data);
    setSugg(null); setRefine(false); setFb(''); setFirstFb(''); setScope(null); setTot(null);
  };
  const undoRefine = () => { if (!undo) return; setTitle(undo.title); setData(undo.data); saveNow(undo.title, undo.data); setUndo(null); };

  // só a fala: um bloco por parágrafo, sem tela, visual, tempos nem legenda
  const copySpeech = async () => { try { await navigator.clipboard.writeText(speechToText(data)); setCopiedSpeech(true); setTimeout(() => setCopiedSpeech(false), 1800); } catch { /* sem permissão de área de transferência */ } };
  const copy = async () => { try { await navigator.clipboard.writeText(scriptToText(title, data)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sem permissão de área de transferência */ } };
  // duplicar e excluir mostram o que deu errado (antes, uma ação que falhava, por exemplo com a página aberta de antes de uma atualização do app, não fazia nada e não avisava)
  const [busy, setBusy] = useState(false);
  const [actErr, setActErr] = useState('');
  const dup = async () => {
    if (busy) return;
    setBusy(true); setActErr('');
    try { const r = await duplicateScript(id); if (r.id) router.push(`/admin/videos/${r.id}`); else { setActErr(r.error ?? 'Não foi possível duplicar o roteiro.'); setBusy(false); } }
    catch (e) { setActErr(actionErrorMessage(e)); setBusy(false); }
  };
  const del = async () => {
    if (busy || !confirm('Excluir este roteiro? Isso não pode ser desfeito.')) return;
    setBusy(true); setActErr('');
    try {
      const r = await deleteScript(id);
      if (r.error) { setActErr(r.error); setBusy(false); return; }
      router.replace('/admin/videos'); // o roteiro não existe mais: sai da página
    } catch (e) { setActErr(actionErrorMessage(e)); setBusy(false); }
  };

  return (
    <div className={'vd-script'}>
      {actErr && <div className="notice err" role="alert" style={{ marginBottom: 12 }}>{actErr}</div>}
      {save === 'error' && (
        <div className="notice err" role="alert" style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span><b>Suas alterações ainda não foram salvas.</b> {saveMsg || 'Não foi possível salvar.'} Se for recarregar a página, copie antes o que escreveu.</span>
          <button type="button" className="btn small" onClick={flush}>Tentar de novo</button>
        </div>
      )}
      <input className="vd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Título do roteiro" placeholder="Título do roteiro" />
      <div className="vd-tbar" role="toolbar" aria-label="Ferramentas do roteiro">
        <div className="vd-tbar-g">
          <button type="button" className="vd-tb" onClick={() => stepHist('back')} disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶<span>Desfazer</span></button>
          <button type="button" className="vd-tb" onClick={() => stepHist('fwd')} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">↷<span>Refazer</span></button>
        </div>
        <div className="vd-tbar-g">
          <button type="button" className="vd-tb" onClick={() => openPara(caretIdx ?? 0)} disabled={!hasKey || caretIdx === null || !data.parts[caretIdx]?.speech.trim()} title="Clique em um parágrafo e peça um ajuste só nele (ou selecione um trecho)"><IconSpark /><span>Refinar parágrafo</span></button>
          <button type="button" className="vd-tb" onClick={() => setRefine((o) => !o)} disabled={!hasKey} aria-expanded={refine} title="Pedir à IA um ajuste no roteiro inteiro, inclusive na duração do vídeo"><IconSpark /><span>Refinar roteiro</span></button>
          <button type="button" className={`vd-tb${showNotes ? ' on' : ''}`} onClick={() => setShowNotes((f) => !f)} aria-pressed={showNotes} title="Mostra, parágrafo por parágrafo, o texto na tela e o que gravar">Aa<span>Tela e visual</span></button>
          <button type="button" className="vd-tb" onClick={() => setPrompter(true)} title="Tela cheia para gravar lendo"><IconPlay /><span>Teleprompter</span></button>
        </div>
        <div className="vd-tbar-g">
          <button type="button" className="vd-tb" onClick={copy} title="Copia o roteiro completo"><IconCopy /><span>{copied ? 'Copiado!' : 'Copiar'}</span></button>
          <button type="button" className="vd-tb" onClick={copySpeech} title="Copia só o texto da fala, um bloco por parágrafo (sem tela, visual, tempos nem legenda)"><IconCopy /><span>{copiedSpeech ? 'Fala copiada!' : 'Copiar fala'}</span></button>
        </div>
        <div className="vd-tbar-g vd-tbar-end">
          <span className={`vd-save ${save}`} role="status">{save === 'saved' ? 'Salvo' : save === 'error' ? 'Erro ao salvar' : 'Salvando…'}</span>
          <select className="vd-stage-select" value={status} onChange={(e) => setStatus(e.target.value as Stage)} style={{ '--c': stageOf(status).color } as React.CSSProperties} aria-label="Etapa do vídeo">
            {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
          </select>
          <details className="vd-more">
            <summary aria-label="Mais ações" title="Mais ações">⋯</summary>
            <div className="vd-more-menu">
              <button type="button" onClick={dup} disabled={busy}>Duplicar roteiro</button>
              <button type="button" className="danger" onClick={del} disabled={busy}>{busy ? '…' : 'Excluir roteiro'}</button>
            </div>
          </details>
        </div>
      </div>

      {undo && <div className="notice info vd-undo">Refinamento aplicado e salvo. <button type="button" className="btn small" onClick={undoRefine}>↶ Desfazer</button></div>}
      {refine && (
        <div className="pe-refine vd-refine">
          <div className="pe-refine-head"><b>Refinar roteiro com IA</b><button type="button" className="btn small ghost" onClick={() => { setRefine(false); setSugg(null); setRerr(''); }}>Fechar</button></div>
          {!sugg ? (
            <>
              <p className="muted">Diga o que mudar. A IA propõe a versão ajustada, você compara e só aplica se gostar (e pode desfazer depois).</p>
              <div className="vd-chips" role="group" aria-label="O que refinar">
                <button type="button" className={`vd-chip${scope === null ? ' on' : ''}`} onClick={() => setScope(null)}>Roteiro inteiro</button>
                {data.parts.map((p, k) => <button key={k} type="button" className={`vd-chip${scope === k ? ' on' : ''}`} onClick={() => setScope(k)}>{k + 1}. {p.speech.trim().slice(0, 22) || 'vazio'}…</button>)}
              </div>
              <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={800} placeholder="Ex.: o gancho está fraco, comece com a dor; corte as frases longas; deixe a CTA mais natural…" />
              {scope === null && (
                <div className="vd-secs">
                  <span>Duração do vídeo</span>
                  <div className="vd-stepper">
                    <button type="button" onClick={() => setTot(Math.max(data.parts.length * MIN_PART_SECONDS, (tot ?? total) - 5))} aria-label="Menos 5 segundos" disabled={rbusy}>−</button>
                    <input type="number" min={data.parts.length * MIN_PART_SECONDS} max={Math.min(MAX_SECONDS, data.parts.length * MAX_PART_SECONDS)} value={tot ?? total} disabled={rbusy} onChange={(e) => setTot(Math.min(MAX_SECONDS, Math.max(0, Math.round(Number(e.target.value)) || 0)))} onBlur={() => setTot((x) => (x === null ? x : Math.max(data.parts.length * MIN_PART_SECONDS, x)))} aria-label="Duração total do vídeo em segundos" /> <span>s</span>
                    <button type="button" onClick={() => setTot(Math.min(MAX_SECONDS, Math.min(data.parts.length * MAX_PART_SECONDS, (tot ?? total) + 5)))} aria-label="Mais 5 segundos" disabled={rbusy}>+</button>
                  </div>
                  <small className="muted">{durChanged ? `era ${fmtSecs(total)} · ${(tot ?? total) > total ? 'a fala cresce' : 'a fala encurta'}, na proporção de cada trecho · ` : ''}≈ {wordsFor(tot ?? total)} palavras de fala no total</small>
                </div>
              )}
              <div className="aim-chips pe-chips-row">{CHIPS.map((c) => <button type="button" key={c} onClick={() => setFb((t) => (t.trim() ? `${t.trim()}; ` : '') + c.toLowerCase())}>{c}</button>)}</div>
              {rerr && <div className="notice err">{rerr}</div>}
              {rbusy && <div className="notice info" role="status">Refinando o roteiro… leva cerca de 15 a 40 segundos.</div>}
              <button type="button" className="btn primary" onClick={() => { const f = fb.trim() || 'Ajuste o roteiro para a nova duração.'; setFirstFb(f); askRefine(f); }} disabled={rbusy || (fb.trim().length < 3 && !durChanged)}>{rbusy ? 'Refinando…' : <><IconSpark /> Sugerir refinamento</>}</button>
            </>
          ) : (
            <>
              {sugg.note && <p className="pe-note">{sugg.note}</p>}
              {totalSeconds(sugg.data) !== total && <p className="vd-newdur">Duração do vídeo: <s>{fmtSecs(total)}</s> → <b>{fmtSecs(totalSeconds(sugg.data))}</b></p>}
              {changes.length === 0 ? <p className="muted">A IA não mudou nada. Tente pedir de outro jeito.</p> : (
                <Review title={title} data={data} sugg={sugg} />
              )}
              {rerr && <div className="notice err">{rerr}</div>}
              <div className="pe-refine-actions">
                <button type="button" className="btn primary" onClick={applyRefined} disabled={changes.length === 0}>✓ Aplicar no roteiro</button>
                <button type="button" className="btn ghost" onClick={() => { setSugg(null); setRerr(''); }}>Descartar</button>
              </div>
              <div className="aim-fb">
                <b style={{ fontSize: 13 }}>Não é bem isso? Peça outro ajuste</b>
                <textarea rows={2} value={fb2} onChange={(e) => setFb2(e.target.value)} maxLength={800} placeholder="Ex.: ainda está longo; mantenha o gancho como estava…" />
                <button type="button" className="btn" onClick={() => askRefine(`${firstFb}\n(Novo pedido sobre a sugestão anterior): ${fb2.trim()}`, { title: sugg.title, data: sugg.data })} disabled={rbusy || fb2.trim().length < 3}>{rbusy ? 'Refinando…' : '↻ Ajustar de novo'}</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="vd-meta big">{meta.formatName && <><span>{meta.formatName}</span><i>·</i></>}<span>{fmtSecs(total)}</span></div>
      {meta.angle && <p className="vd-angle"><b>Ideia:</b> {meta.angle}</p>}

      <p className={`vd-count ${timing}`}>
        <b>{words} palavras</b> · ~{fmtSecs(spoken)} de fala para {fmtSecs(total)} de vídeo ·{' '}
        {timing === 'ok' ? 'cabe no tempo.' : timing === 'over' ? 'passa do tempo: corte algumas palavras.' : 'sobra tempo: dá para falar um pouco mais.'}
      </p>

      {data.notes.length > 0 && (
        <div className="notice warn vd-notes"><b>Conferir antes de gravar</b><ul>{data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
      )}

      <div className="vd-page-wrap">
        <Doc texts={texts} onTexts={onTexts} onCaret={setCaretIdx} onSel={setSel} highlight={pr?.i ?? null} />
      </div>
      {sel && hasKey && !pr && (
        <button type="button" className="vd-selbar vd-selfloat" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()} onClick={() => openPara(sel.i, sel.text)}><IconSpark /> Refinar este trecho</button>
      )}

      {showNotes && (
        <section className="card-surface vd-notes-card">
          <b>Tela e visual</b>
          <p className="muted">O que aparece escrito na tela e o que mostrar, parágrafo por parágrafo.</p>
          {data.parts.map((p, i) => (
            <div key={i} className="vd-note-row">
              <span className="vd-note-ref">{i + 1}. “{p.speech.trim().slice(0, 48) || 'vazio'}{p.speech.trim().length > 48 ? '…' : ''}”</span>
              <label htmlFor={`o${i}`}>Texto na tela</label>
              <Auto id={`o${i}`} value={p.onScreen} maxLength={200} placeholder="—" onChange={(e) => setPart(i, { onScreen: e.target.value })} />
              <label htmlFor={`v${i}`}>Visual</label>
              <Auto id={`v${i}`} value={p.visual} placeholder="—" onChange={(e) => setPart(i, { visual: e.target.value })} />
            </div>
          ))}
        </section>
      )}

      {pr && data.parts[pr.i] && (() => {
        const i = pr.i, p = data.parts[i];
        return (
          <div className="vd-dock id-fref" role="region" aria-label="Refinar parágrafo com IA">
            <div className="vd-dock-head"><b>Refinar o parágrafo {i + 1}</b><span className="vd-dock-quote">“{p.speech.trim().slice(0, 90)}{p.speech.trim().length > 90 ? '…' : ''}”</span><button type="button" className="btn small ghost" onClick={() => setPr(null)}>✕</button></div>
            {pr.sugg === null ? (
              <>
                <textarea rows={2} autoFocus value={pr.fb} onChange={(e) => setPr({ ...pr, fb: e.target.value })} maxLength={800} placeholder="O que mudar neste parágrafo? Ex.: comece pela dor, corte as frases longas, deixe a fala mais natural…" />
                <div className="aim-chips pe-chips-row">{PCHIPS.map((c) => <button type="button" key={c} onClick={() => setPr({ ...pr, fb: (pr.fb.trim() ? `${pr.fb.trim()}; ` : '') + c.toLowerCase() })}>{c}</button>)}</div>
              </>
            ) : (
              <div className="id-fdiff">
                {pr.note && <p className="pe-note">{pr.note}</p>}
                {partChanges(i).length === 0 ? <p className="muted">A IA não mudou nada neste trecho. Tente pedir de outro jeito.</p> : <>
                  <p className="muted vd-legend">Como no controle de alterações: <ins>verde</ins> entra, <del>riscado</del> sai.</p>
                  {partChanges(i).map((c) => <div key={c.label}><span>{c.label}</span><p className="vd-track"><Track before={c.before} after={c.after} /></p></div>)}
                </>}
                <textarea rows={2} value={pr.fb} onChange={(e) => setPr({ ...pr, fb: e.target.value })} maxLength={800} placeholder="Não é bem isso? Peça outro ajuste sobre esta sugestão…" />
              </div>
            )}
            {pr.err && <div className="notice err">{pr.err}</div>}
            {pr.busy && <div className="notice info" role="status">Refinando… leva cerca de 15 a 30 segundos.</div>}
            <div className="row-actions">
              {pr.sugg !== null && <button type="button" className="btn small primary" onClick={applyPart} disabled={partChanges(i).length === 0}>✓ Aplicar neste trecho</button>}
              <button type="button" className={`btn small${pr.sugg === null ? ' primary' : ''}`} onClick={askPart} disabled={pr.busy || pr.fb.trim().length < 3}>{pr.busy ? 'Refinando…' : pr.sugg === null ? <><IconSpark /> Sugerir</> : 'Pedir outro ajuste'}</button>
              <button type="button" className="btn small ghost" onClick={() => setPr(null)}>{pr.sugg === null ? 'Cancelar' : 'Descartar'}</button>
            </div>
          </div>
        );
      })()}

      {data.production && (data.production.rhythm || data.production.sources.length > 0 || data.production.shortVersion) && (
        <section className="card-surface vd-prod">
          <b>Produção</b>
          {data.production.rhythm && <p><span className="muted">Ritmo e edição:</span> {data.production.rhythm}</p>}
          {data.production.sources.length > 0 && <div><span className="muted">Fontes para o rodapé dos números:</span><ul>{data.production.sources.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {data.production.shortVersion && <p><span className="muted">Versão de 30 s:</span> {data.production.shortVersion}</p>}
        </section>
      )}

      {data.markdown && (
        <details className="card-surface vd-orig">
          <summary><b>Roteiro original da IA</b> <span className="muted">(o texto inteiro, como foi escrito; o texto acima é uma cópia para editar)</span></summary>
          <div className="row-actions" style={{ margin: '10px 0' }}><button type="button" className="btn small" onClick={() => { navigator.clipboard?.writeText(data.markdown!).catch(() => {}); }}>Copiar o texto original</button></div>
          <div className="vd-orig-text">{data.markdown}</div>
        </details>
      )}

      <div className="card-surface form-card vd-cap">
        <div className="id-fhead" style={{ marginBottom: 8 }}>
          <b style={{ fontFamily: 'var(--font-head)', fontSize: 15 }}>Legenda e hashtags</b>
          <button type="button" className="btn small ghost id-fai" onClick={() => setCr(cr ? null : { fb: '', busy: false, err: '', sugg: null, note: '' })} disabled={!hasKey} aria-expanded={!!cr} title={!hasKey ? 'A IA não está configurada neste servidor' : 'Refinar a legenda e as hashtags com IA'}><IconSpark /> {data.caption.trim() ? 'Refinar' : 'Sugerir'}</button>
        </div>
        {cr && (
          <div className="id-fref" style={{ marginBottom: 12 }}>
            {cr.sugg === null ? (
              <>
                <textarea rows={2} autoFocus value={cr.fb} onChange={(e) => setCr({ ...cr, fb: e.target.value })} maxLength={800} placeholder={data.caption.trim() ? 'O que mudar na legenda? Ex.: mais curta, comece com a dor, menos hashtags…' : 'Como deve ser a legenda? Ex.: curta, com a pergunta do gancho e um convite para comentar…'} />
                <div className="aim-chips pe-chips-row">{CCHIPS.map((c) => <button type="button" key={c} onClick={() => setCr({ ...cr, fb: (cr.fb.trim() ? `${cr.fb.trim()}; ` : '') + c.toLowerCase() })}>{c}</button>)}</div>
              </>
            ) : (
              <div className="id-fdiff">
                {cr.note && <p className="pe-note">{cr.note}</p>}
                {!capChanged ? <p className="muted">A IA não mudou nada. Tente pedir de outro jeito.</p> : (
                  <>
                    {cr.sugg.caption.trim() !== data.caption.trim() && <div><span>Legenda</span>{data.caption.trim() && <s>{data.caption}</s>}<p>{cr.sugg.caption || '(vazio)'}</p></div>}
                    {tagText(cr.sugg.hashtags) !== tagText(data.hashtags) && <div><span>Hashtags</span>{data.hashtags.length > 0 && <s>{tagText(data.hashtags)}</s>}<p>{tagText(cr.sugg.hashtags) || '(vazio)'}</p></div>}
                  </>
                )}
                <textarea rows={2} value={cr.fb} onChange={(e) => setCr({ ...cr, fb: e.target.value })} maxLength={800} placeholder="Não é bem isso? Peça outro ajuste sobre esta sugestão…" />
              </div>
            )}
            {cr.err && <div className="notice err">{cr.err}</div>}
            {cr.busy && <div className="notice info" role="status">Refinando… leva cerca de 10 a 25 segundos.</div>}
            <div className="row-actions">
              {cr.sugg !== null && <button type="button" className="btn small primary" onClick={applyCaption} disabled={!capChanged}>✓ Aplicar na legenda</button>}
              <button type="button" className={`btn small${cr.sugg === null ? ' primary' : ''}`} onClick={askCaption} disabled={cr.busy || cr.fb.trim().length < 3}>{cr.busy ? 'Refinando…' : cr.sugg === null ? <><IconSpark /> Sugerir</> : 'Pedir outro ajuste'}</button>
              <button type="button" className="btn small ghost" onClick={() => setCr(null)}>{cr.sugg === null ? 'Cancelar' : 'Descartar'}</button>
            </div>
          </div>
        )}
        <div className="field"><label htmlFor="cap">Legenda</label><textarea id="cap" rows={3} value={data.caption} onChange={(e) => setData((d) => ({ ...d, caption: e.target.value }))} maxLength={2200} /></div>
        <div className="field"><label htmlFor="tags">Hashtags <span className="muted">(separadas por espaço)</span></label>
          <input id="tags" value={data.hashtags.map((h) => `#${h}`).join(' ')} onChange={(e) => setData((d) => ({ ...d, hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, '')).filter(Boolean) }))} /></div>
      </div>

      {prompter && <Teleprompter parts={data.parts} onClose={() => setPrompter(false)} />}
    </div>
  );
}

/** Tela cheia com a fala rolando sozinha, para gravar lendo. */
function Teleprompter({ parts, onClose }: { parts: ScriptData['parts']; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(40); // px por segundo
  const [size, setSize] = useState(46);
  const speedRef = useRef(speed); speedRef.current = speed;

  useEffect(() => {
    if (!play) return;
    let raf = 0, last = performance.now(), pos = box.current?.scrollTop ?? 0;
    const tick = (t: number) => {
      const el = box.current; if (!el) return;
      pos += ((t - last) / 1000) * speedRef.current; last = t;
      el.scrollTop = pos;
      if (pos < el.scrollHeight - el.clientHeight) raf = requestAnimationFrame(tick); else setPlay(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); setPlay((p) => !p); } };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="vd-prompter" role="dialog" aria-modal="true" aria-label="Teleprompter">
      <div className="vd-prompter-bar">
        <button type="button" className="btn small" onClick={() => setPlay((p) => !p)}>{play ? '❚❚ Pausar' : '▶ Rolar'}</button>
        <label>Velocidade <input type="range" min={10} max={140} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
        <label>Tamanho <input type="range" min={28} max={90} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
        <span className="muted">Espaço pausa · Esc fecha</span>
        <button type="button" className="btn small" onClick={onClose}>Fechar</button>
      </div>
      <div className="vd-prompter-text" ref={box} style={{ fontSize: size }}>
        <div className="vd-prompter-pad" />
        {parts.map((p, i) => (
          <div key={i} className="vd-prompter-part"><small>{p.name}</small><p>{p.speech}</p></div>
        ))}
        <div className="vd-prompter-pad" />
      </div>
    </div>
  );
}


/**
 * A página do roteiro: um único texto editável, como num editor de texto. Cada parágrafo é um trecho do roteiro.
 * Dá para clicar em qualquer ponto, selecionar entre parágrafos, navegar com as setas, e Enter/Backspace/colar funcionam como esperado.
 * O texto vive no próprio campo editável (sem React por dentro, para o cursor não pular): só se refaz quando o roteiro muda por fora (desfazer, refinar com IA).
 */
function Doc({ texts, onTexts, onCaret, onSel, highlight }: { texts: string[]; onTexts: (t: string[]) => void; onCaret: (i: number | null) => void; onSel: (s: { i: number; text: string; x: number; y: number } | null) => void; highlight: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<string[] | null>(null);
  const mkP = (t: string) => { const p = document.createElement('p'); if (t) p.textContent = t; else p.appendChild(document.createElement('br')); return p; };
  useIsoLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const s = shown.current;
    if (s && s.length === texts.length && s.every((t, k) => t === texts[k])) return;
    el.replaceChildren(...texts.map(mkP)); shown.current = [...texts];
  }, [texts]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    [...el.children].forEach((c, k) => c.classList.toggle('vd-p-on', k === highlight));
  });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* navegador sem suporte */ }
    const paraOf = (n: Node | null) => { while (n && n.parentNode !== el) n = n.parentNode; return n ? [...el.children].indexOf(n as Element) : -1; };
    const onSelection = () => {
      const s = window.getSelection();
      if (!s || !s.rangeCount || !el.contains(s.getRangeAt(0).commonAncestorContainer)) { onSel(null); return; }
      const r = s.getRangeAt(0), idx = paraOf(s.anchorNode);
      if (idx >= 0) onCaret(idx);
      const text = s.toString().trim();
      if (s.isCollapsed || text.length < 6) { onSel(null); return; }
      const b = r.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) { onSel(null); return; }
      onSel({ i: Math.max(0, paraOf(r.startContainer)), text: text.slice(0, 400), x: Math.min(Math.max(b.left + b.width / 2, 90), window.innerWidth - 90), y: Math.max(b.top, 56) });
    };
    const noFormat = (e: Event) => { if (String((e as InputEvent).inputType).startsWith('format')) e.preventDefault(); };
    const onPaste = (e: ClipboardEvent) => { // cola só o texto, um parágrafo por linha
      e.preventDefault();
      const lines = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
      lines.forEach((l, k) => { if (k) document.execCommand('insertParagraph'); document.execCommand('insertText', false, l); });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertParagraph'); } };
    const onDown = (e: MouseEvent) => { // clicar na margem ou abaixo do texto leva o cursor para o fim
      if (e.target !== el) return;
      const last = el.lastElementChild; if (!last) return;
      e.preventDefault(); el.focus();
      const r = document.createRange(); r.selectNodeContents(last); r.collapse(false);
      const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    };
    document.addEventListener('selectionchange', onSelection);
    window.addEventListener('scroll', onSelection, true); window.addEventListener('resize', onSelection);
    el.addEventListener('beforeinput', noFormat); el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey); el.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('selectionchange', onSelection);
      window.removeEventListener('scroll', onSelection, true); window.removeEventListener('resize', onSelection);
      el.removeEventListener('beforeinput', noFormat); el.removeEventListener('paste', onPaste); el.removeEventListener('keydown', onKey); el.removeEventListener('mousedown', onDown);
    };
  }, [onCaret, onSel]);
  const read = () => {
    const el = ref.current; if (!el) return;
    const out: string[] = [];
    el.childNodes.forEach((n) => { if (n.nodeType === 1) out.push(n.textContent ?? ''); else if (n.nodeType === 3 && (n.textContent ?? '').trim()) out.push(n.textContent ?? ''); });
    const next = out.length ? out : [''];
    shown.current = next; onTexts(next);
  };
  const empty = texts.length === 1 && !texts[0].trim();
  return <div ref={ref} className={`vd-page${empty ? ' empty' : ''}`} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Fala do roteiro: um parágrafo por trecho" spellCheck lang="pt-BR" onInput={read} />;
}

/** Caixa de texto que cresce com o conteúdo (sem barra de rolagem dentro dela), para ler o roteiro como um todo. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
export function Auto({ value, className, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'rows' | 'style'> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`; } }, []);
  useIsoLayoutEffect(fit, [value, fit]);
  useEffect(() => { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [fit]);
  return <textarea ref={ref} rows={1} value={value} className={className} style={{ overflow: 'hidden', resize: 'none' }} {...rest} />;
}

/** O roteiro sugerido por inteiro, no mesmo formato do editor (falas uma embaixo da outra, tela e visual ao lado). O que mudou fica marcado e o texto antigo aparece logo abaixo. */
export function Review({ title, data, sugg }: { title: string; data: ScriptData; sugg: { title: string; data: ScriptData } }) {
  const diff = (b: string, a: string) => b.trim() !== a.trim();
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
  let t = 0;
  const rows = sugg.data.parts.map((p, k) => { const start = t; t += p.seconds; return { p, k, c: data.parts[k], start }; });
  const changed = rows.filter(({ p, c }) => c && (diff(c.speech, p.speech) || diff(c.onScreen, p.onScreen) || diff(c.visual, p.visual) || c.seconds !== p.seconds)).length;
  const Field = ({ label, before, after }: { label?: string; before: string; after: string }) => (
    <>
      {label && <span className="vd-rev-l">{label}</span>}
      <p className={`vd-rev-t${diff(before, after) ? ' ch' : ''}`}>{diff(before, after) ? <Track before={before} after={after} /> : (after || '—')}</p>
    </>
  );
  return (
    <div className="vd-rev">
      <p className="muted vd-rev-help">{changed ? `${changed} ${changed === 1 ? 'bloco mudou' : 'blocos mudaram'}.` : 'Nenhum bloco mudou.'} O roteiro abaixo é a versão sugerida, inteira. Como no controle de alterações: o que entra aparece em verde e o que sai, riscado.</p>
      {diff(title, sugg.title) && <div className="vd-rev-top"><span className="vd-rev-l">Título</span><p className="vd-rev-t ch"><Track before={title} after={sugg.title} /></p></div>}
      <div className="vd-script-parts vd-doc">
        {rows.map(({ p, k, c, start }) => (
          <section key={k} className="vd-sp">
            <div className="vd-sp-main">
              <Field before={c?.speech ?? ''} after={p.speech} />
            </div>
            <div className="vd-sp-side">
              <Field label="Texto na tela" before={c?.onScreen ?? ''} after={p.onScreen} />
              <Field label="Visual" before={c?.visual ?? ''} after={p.visual} />
            </div>
          </section>
        ))}
      </div>
      {diff(data.caption, sugg.data.caption) && <div className="vd-rev-top"><span className="vd-rev-l">Legenda</span><p className="vd-rev-t ch"><Track before={data.caption} after={sugg.data.caption} /></p></div>}
      {data.hashtags.join(' ') !== sugg.data.hashtags.join(' ') && <div className="vd-rev-top"><span className="vd-rev-l">Hashtags</span><p className="vd-rev-t ch">{sugg.data.hashtags.map((h) => `#${h}`).join(' ')}</p><p className="vd-rev-was">Antes: {data.hashtags.map((h) => `#${h}`).join(' ')}</p></div>}
    </div>
  );
}

/** Mostra o que mudou palavra a palavra: o que entra em destaque, o que sai riscado. */
export function Track({ before, after }: { before: string; after: string }) {
  const segs = wordDiff(before.trim(), after.trim());
  if (!segs.length) return <>—</>;
  return <>{segs.map((s, k) => (s.k === 'same' ? <span key={k}>{s.t}</span> : s.k === 'add' ? <ins key={k}>{s.t}</ins> : <del key={k}>{s.t}</del>))}</>;
}
