'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveArticle } from '@/lib/substack-actions';
import { ARTICLE_STATUS, articleToMarkdown, countWords, plainText, readMinutes, renderMarkdown, reviewArticle, type ArticleMeta, type ArticleStatus } from '@/lib/substack';
import { IconCheck, IconCopy, IconPlus, IconSpark, IconTrash } from '../../../icons';

type State = { title: string; subtitle: string; body: string; status: ArticleStatus; meta: ArticleMeta };
type Tab = 'write' | 'preview' | 'publish';
const CHIPS = ['Deixar mais direto', 'Abrir com uma cena', 'Encurtar', 'Mais caloroso', 'Fortalecer o final', 'Trocar exemplos por outros do dia a dia'];

async function copyRich(html: string, plain: string): Promise<boolean> {
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      return true;
    }
    await navigator.clipboard.writeText(plain); return true;
  } catch { return false; }
}
const copyText = async (t: string) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };

export function ArticleEditor({ id, initial, brandName, hasKey }: { id: string; initial: State; brandName: string; hasKey: boolean }) {
  const [s, setS] = useState<State>(initial);
  const [tab, setTab] = useState<Tab>('write');
  const [saved, setSaved] = useState<'ok' | 'dirty' | 'saving' | 'err'>('ok');
  const [toast, setToast] = useState('');
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [proposal, setProposal] = useState<{ text: string; note: string; range: [number, number] | null; before: string } | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(s); latest.current = s;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const persist = useCallback(async () => {
    setSaved('saving');
    const v = latest.current;
    try { const r = await saveArticle({ id, title: v.title, subtitle: v.subtitle, body: v.body, meta: v.meta, status: v.status }); setSaved(r.error ? 'err' : 'ok'); } catch { setSaved('err'); }
  }, [id]);
  const change = (patch: Partial<State>) => { setS((p) => ({ ...p, ...patch })); setSaved('dirty'); clearTimeout(timer.current); timer.current = setTimeout(persist, 1200); };
  const setMeta = (patch: Partial<ArticleMeta>) => change({ meta: { ...s.meta, ...patch } });
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saved === 'dirty' || saved === 'saving') e.preventDefault(); };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [saved]);

  const words = useMemo(() => countWords(plainText(s.body)), [s.body]);
  const html = useMemo(() => renderMarkdown(s.body), [s.body]);
  const review = useMemo(() => reviewArticle(s), [s]);
  const okCount = review.filter((r) => r.ok).length;

  /* ---- barra de formatação ---- */
  function edit(fn: (v: string, a: number, b: number) => { v: string; a: number; b: number }) {
    const el = ta.current; if (!el) return;
    const r = fn(el.value, el.selectionStart, el.selectionEnd);
    change({ body: r.v });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.a, r.b); });
  }
  const wrap = (m: string) => edit((v, a, b) => ({ v: v.slice(0, a) + m + (v.slice(a, b) || 'texto') + m + v.slice(b), a: a + m.length, b: (b > a ? b : a + 5) + m.length }));
  const prefix = (p: string) => edit((v, a) => { const st = v.lastIndexOf('\n', a - 1) + 1; return { v: v.slice(0, st) + p + v.slice(st), a: a + p.length, b: a + p.length }; });
  const link = () => { const u = window.prompt('Endereço do link (https://…)'); if (u) edit((v, a, b) => { const t = v.slice(a, b) || 'texto do link'; return { v: v.slice(0, a) + `[${t}](${u})` + v.slice(b), a: a + 1, b: a + 1 + t.length }; }); };
  const divider = () => edit((v, a) => ({ v: v.slice(0, a) + '\n\n---\n\n' + v.slice(a), a: a + 7, b: a + 7 }));

  /* ---- refinar com IA ---- */
  async function refine(text: string) {
    const f = text.trim(); if (f.length < 3 || busy) return;
    const range: [number, number] | null = sel[1] - sel[0] >= 3 ? sel : null;
    setBusy(true); setErr(''); setProposal(null);
    try {
      const res = await fetch('/api/substack/refine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: s.title, subtitle: s.subtitle, body: s.body, selection: range ? s.body.slice(range[0], range[1]) : '', feedback: f }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErr(j?.error ?? 'Não foi possível ajustar.'); return; }
      setProposal({ text: j.text, note: j.note, range, before: range ? s.body.slice(range[0], range[1]) : s.body });
    } catch { setErr('Sem conexão. Tente de novo.'); } finally { setBusy(false); }
  }
  function apply() {
    if (!proposal) return;
    setUndo(s.body);
    change({ body: proposal.range ? s.body.slice(0, proposal.range[0]) + proposal.text + s.body.slice(proposal.range[1]) : proposal.text });
    setProposal(null); setFeedback(''); flash('Ajuste aplicado');
  }

  async function copyBody() { flash((await copyRich(html, plainText(s.body))) ? 'Texto copiado: cole no editor do Substack' : 'Não foi possível copiar'); }
  async function copyAll() { flash((await copyRich(`<h1>${esc(s.title)}</h1>${s.subtitle ? `<p><em>${esc(s.subtitle)}</em></p>` : ''}${html}`, articleToMarkdown(s))) ? 'Artigo inteiro copiado' : 'Não foi possível copiar'); }
  function download() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([articleToMarkdown(s)], { type: 'text/markdown' }));
    a.download = `${(s.title || 'artigo').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'artigo'}.md`; a.click(); URL.revokeObjectURL(a.href);
  }

  const st = ARTICLE_STATUS.find((x) => x.id === s.status)!;
  return (
    <div className="sb-ed">
      <div className="sb-bar">
        <div className="sb-tabs" role="tablist">
          {([['write', 'Escrever'], ['preview', 'Prévia'], ['publish', 'Publicação']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <span className={`sb-saved ${saved}`} aria-live="polite">{saved === 'ok' ? '✓ Salvo' : saved === 'saving' ? 'Salvando…' : saved === 'err' ? 'Erro ao salvar' : 'Alterações…'}</span>
        <select className="sb-status" value={s.status} style={{ borderColor: st.color, color: st.color }} onChange={(e) => change({ status: e.target.value as ArticleStatus })} aria-label="Etapa">
          {ARTICLE_STATUS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <button type="button" className="btn primary" onClick={copyBody}><IconCopy /> Copiar para o Substack</button>
      </div>

      <div className="sb-grid">
        <div className="sb-main">
          {tab === 'write' && (
            <div className="sb-paper-ed">
              <Grow className="sb-title-in" value={s.title} max={160} onChange={(v) => change({ title: v })} placeholder="Título" label="Título" />
              <Grow className="sb-sub-in" value={s.subtitle} max={240} onChange={(v) => change({ subtitle: v })} placeholder="Subtítulo" label="Subtítulo" />
              <div className="sb-tools" role="toolbar" aria-label="Formatação">
                <button type="button" onClick={() => prefix('## ')} title="Intertítulo"><b>H2</b></button>
                <button type="button" onClick={() => prefix('### ')} title="Subtítulo menor"><b>H3</b></button>
                <button type="button" onClick={() => wrap('**')} title="Negrito"><b>B</b></button>
                <button type="button" onClick={() => wrap('*')} title="Itálico"><i>I</i></button>
                <button type="button" onClick={link} title="Link">Link</button>
                <button type="button" onClick={() => prefix('> ')} title="Citação">“ ”</button>
                <button type="button" onClick={() => prefix('- ')} title="Lista">• Lista</button>
                <button type="button" onClick={divider} title="Divisor">—</button>
                <span className="sb-count">{words} palavras · {readMinutes(words)} min</span>
              </div>
              <textarea ref={ta} className="sb-body-in" value={s.body} onChange={(e) => change({ body: e.target.value })} onSelect={(e) => setSel([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])} placeholder="Escreva aqui…" aria-label="Texto do artigo" spellCheck lang="pt-BR" />
            </div>
          )}

          {tab === 'preview' && (
            <article className="sb-read">
              <h1>{s.title || 'Sem título'}</h1>
              {s.subtitle && <p className="sb-read-sub">{s.subtitle}</p>}
              <div className="sb-by"><span className="sb-av">{(brandName || 'M').slice(0, 1).toUpperCase()}</span><div><b>{brandName}</b><small>{readMinutes(words)} min de leitura</small></div></div>
              <div className="sb-read-body" dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          )}

          {tab === 'publish' && (
            <div className="sb-pub">
              <div className="sb-inbox" aria-label="Como chega na caixa de entrada">
                <small>Como chega na caixa de entrada</small>
                <div className="sb-mail"><span className="sb-av">{(brandName || 'M').slice(0, 1).toUpperCase()}</span><div><b>{brandName}</b><strong>{s.meta.emailSubject || s.title || 'Assunto do e-mail'}</strong><span>{s.meta.previewText || s.subtitle || 'Linha de prévia'}</span></div></div>
              </div>
              <label className="field">Assunto do e-mail <span className="muted">{s.meta.emailSubject.length}/60</span>
                <input value={s.meta.emailSubject} maxLength={100} onChange={(e) => setMeta({ emailSubject: e.target.value })} placeholder={s.title} />
              </label>
              <label className="field">Linha de prévia <span className="muted">{s.meta.previewText.length}/110</span>
                <input value={s.meta.previewText} maxLength={160} onChange={(e) => setMeta({ previewText: e.target.value })} />
              </label>
              <label className="field">Descrição para busca e compartilhamento <span className="muted">{s.meta.seoDescription.length}/155</span>
                <textarea rows={2} value={s.meta.seoDescription} maxLength={200} onChange={(e) => setMeta({ seoDescription: e.target.value })} />
              </label>
              <label className="field">Tags (separadas por vírgula)
                <input value={s.meta.tags.join(', ')} onChange={(e) => setMeta({ tags: e.target.value.split(',').map((t) => t.trimStart()) })} onBlur={() => setMeta({ tags: s.meta.tags.map((t) => t.trim()).filter(Boolean) })} />
              </label>
              <div className="sb-notes">
                <div className="sb-notes-h"><div><b>Notes para divulgar</b><small className="muted">Textos curtos para postar no Substack Notes quando publicar.</small></div>
                  {s.meta.notes.length < 6 && <button type="button" className="btn small" onClick={() => setMeta({ notes: [...s.meta.notes, ''] })}><IconPlus /> Adicionar</button>}</div>
                {s.meta.notes.length === 0 && <p className="muted">Nenhum Note ainda.</p>}
                {s.meta.notes.map((n, i) => (
                  <div key={i} className="sb-note">
                    <textarea rows={3} value={n} maxLength={300} onChange={(e) => setMeta({ notes: s.meta.notes.map((x, k) => (k === i ? e.target.value : x)) })} aria-label={`Note ${i + 1}`} />
                    <div><small className={n.length > 280 ? 'over' : 'muted'}>{n.length}/280</small>
                      <button type="button" className="btn small ghost" onClick={async () => flash((await copyText(n)) ? 'Note copiado' : 'Não foi possível copiar')}><IconCopy /> Copiar</button>
                      <button type="button" className="btn small ghost danger" onClick={() => setMeta({ notes: s.meta.notes.filter((_, k) => k !== i) })} aria-label="Remover Note"><IconTrash /></button></div>
                  </div>
                ))}
              </div>
              {s.meta.toVerify.length > 0 && (
                <div className="sb-verify"><b>Conferir antes de publicar</b>
                  {s.meta.toVerify.map((v, i) => <label key={i}><input type="checkbox" onChange={(e) => e.currentTarget.parentElement?.classList.toggle('done', e.currentTarget.checked)} /> {v}</label>)}
                </div>
              )}
              <div className="row-actions"><button type="button" className="btn" onClick={copyAll}><IconCopy /> Copiar artigo inteiro</button><button type="button" className="btn" onClick={download}>Baixar .md</button></div>
            </div>
          )}
        </div>

        <aside className="sb-side">
          <section className="sb-card">
            <div className="sb-card-h"><b>Revisão do especialista</b><span className={`sb-score${okCount === review.length ? ' all' : ''}`}>{okCount}/{review.length}</span></div>
            <div className="sb-prog"><i style={{ width: `${(okCount / review.length) * 100}%` }} /></div>
            <ul className="sb-rev">
              {review.map((r) => (
                <li key={r.label} className={r.ok ? 'ok' : 'warn'}><i>{r.ok ? <IconCheck /> : '!'}</i><span><b>{r.label}</b><small>{r.detail}</small></span></li>
              ))}
            </ul>
          </section>

          <section className="sb-card">
            <div className="sb-card-h"><b>Refinar com IA</b></div>
            {!hasKey ? <p className="muted">A IA ainda não foi configurada neste servidor.</p> : (
              <>
                <p className="muted sb-scope">{sel[1] - sel[0] >= 3 ? `Vale para o trecho selecionado (${countWords(s.body.slice(sel[0], sel[1]))} palavras).` : 'Vale para o artigo inteiro. Selecione um trecho no texto para ajustar só ele.'}</p>
                <div className="sb-chips sm">{CHIPS.map((c) => <button key={c} type="button" className="sb-chip" disabled={busy} onClick={() => { setFeedback(c); refine(c); }}>{c}</button>)}</div>
                <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={800} placeholder="Ou peça do seu jeito…" aria-label="Pedido de ajuste" />
                <button type="button" className="btn primary small" disabled={busy || feedback.trim().length < 3 || s.body.trim().length < 40} onClick={() => refine(feedback)}><IconSpark /> {busy ? 'Ajustando…' : 'Ajustar'}</button>
                {err && <p className="sb-error">{err}</p>}
                {proposal && (
                  <div className="sb-prop">
                    <small>{proposal.note || 'Proposta da IA'}</small>
                    <div className="sb-ba"><div><b>Antes</b><p>{clip(proposal.before)}</p></div><div><b>Depois</b><p>{clip(proposal.text)}</p></div></div>
                    <div className="row-actions"><button type="button" className="btn small primary" onClick={apply}>Aplicar</button><button type="button" className="btn small" onClick={() => setProposal(null)}>Descartar</button></div>
                  </div>
                )}
                {undo !== null && !proposal && <button type="button" className="vd-link" onClick={() => { change({ body: undo }); setUndo(null); flash('Desfeito'); }}>Desfazer o último ajuste</button>}
              </>
            )}
          </section>
        </aside>
      </div>
      {toast && <div className="sb-toast" role="status">{toast}</div>}
    </div>
  );
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (t: string) => (t.length > 700 ? `${t.slice(0, 700)}…` : t);

/** Campo de texto que quebra linha e cresce com o conteúdo (título e subtítulo). Enter não cria linha nova. */
function Grow({ value, onChange, className, placeholder, label, max }: { value: string; onChange: (v: string) => void; className: string; placeholder: string; label: string; max: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = '0px'; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return <textarea ref={ref} rows={1} className={className} value={value} maxLength={max} placeholder={placeholder} aria-label={label} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))} />;
}
