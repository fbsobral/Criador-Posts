/** Tipos e cálculos do módulo de roteiros de vídeo curto (usados no servidor e no navegador). */

/** Uma parte do formato: o que acontece nela e quanto do tempo ocupa (peso relativo). */
export type VideoPart = { id: string; name: string; instruction: string; percent: number };

export type Platform = 'reels' | 'tiktok' | 'shorts' | 'all';
export const PLATFORMS: { id: Platform; label: string; hint: string }[] = [
  { id: 'reels', label: 'Reels', hint: 'Instagram' },
  { id: 'tiktok', label: 'TikTok', hint: 'TikTok' },
  { id: 'shorts', label: 'Shorts', hint: 'YouTube' },
  { id: 'all', label: 'Todas', hint: 'Reels, TikTok e Shorts' },
];

/** Um roteiro de menos de 45 s não comporta conteúdo (gancho, desenvolvimento e CTA): este é o mínimo. */
export const DURATION_PRESETS = [45, 60, 90, 120];
export const MIN_SECONDS = 45;
export const MAX_SECONDS = 180;
/** Blocos de um roteiro: a IA escreve livre e um vídeo de lista rápida pode ter muitos cortes. */
export const MAX_PARTS = 16;
export const MAX_VIDEO_IDEAS = 10;
export const MAX_CONTENT_CHARS = 30000;
/** Fala natural em português: ~150 palavras por minuto. */
export const WORDS_PER_SEC = 2.5;
/** Média medida/estimada por roteiro (conteúdo longo em cache), para a estimativa antes de rodar. */
export const ESTIMATED_COST_PER_SCRIPT = 0.05;
export const ESTIMATED_COST_PLAN = 0.04;

/** Texto de cada parte do roteiro gerado. */
export type ScriptPart = { name: string; seconds: number; speech: string; onScreen: string; visual: string };
/** Orientações de produção (roteiros com estrutura livre): ritmo de cortes, fontes dos números e como fazer a versão curta. */
export type ScriptProduction = { rhythm: string; sources: string[]; shortVersion: string };
/** markdown: o roteiro como a IA escreveu, inteiro (os campos são uma cópia dele, para editar). */
export type ScriptData = { parts: ScriptPart[]; caption: string; hashtags: string[]; notes: string[]; production?: ScriptProduction; markdown?: string };


export type VideoIdea = { title: string; angle: string; points: string[] };

/** Divide a duração total entre as partes, proporcional ao peso de cada uma (soma exata, mínimo 1 s). */
export function allocate(parts: { percent: number }[], total: number): number[] {
  if (!parts.length) return [];
  const sum = parts.reduce((a, p) => a + Math.max(0, p.percent), 0) || parts.length;
  const raw = parts.map((p) => ((sum === parts.length && !parts.some((x) => x.percent > 0) ? 1 : Math.max(0, p.percent)) / sum) * total);
  const secs = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = Math.round(total) - secs.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; diff !== 0 && k < 1000; k++) {
    const i = order[k % order.length].i;
    if (diff > 0) { secs[i]++; diff--; } else if (secs[i] > 1) { secs[i]--; diff++; }
  }
  return secs;
}

/** Duração de um bloco que o usuário pode escolher ao refinar. */
export const MIN_PART_SECONDS = 2;
export const MAX_PART_SECONDS = 90;
/** O vídeo dura a soma dos blocos. */
export const totalSeconds = (d: { parts: { seconds: number }[] }) => d.parts.reduce((a, p) => a + p.seconds, 0);
/** Muda a duração de um bloco. Devolve o roteiro novo e a mudança (de, para), ou null se o valor é inválido ou igual ao atual. */
export function withPartSeconds(d: ScriptData, i: number, sec: unknown): { data: ScriptData; from: number; to: number } | null {
  const to = Math.round(Number(sec));
  const cur = d.parts[i];
  if (!cur || !Number.isFinite(to) || to < MIN_PART_SECONDS || to > MAX_PART_SECONDS || cur.seconds === to) return null;
  return { data: { ...d, parts: d.parts.map((p, k) => (k === i ? { ...p, seconds: to } : p)) }, from: cur.seconds, to };
}

export const wordsFor = (seconds: number) => Math.max(3, Math.round(seconds * WORDS_PER_SEC));
export const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
/** Tempo estimado para falar o texto. */
export const speakSeconds = (t: string) => countWords(t) / WORDS_PER_SEC;

export const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ` ${String(Math.round(s % 60)).padStart(2, '0')}s` : ''}` : `${Math.round(s)}s`);

/** Cores das partes na linha do tempo (repetem se houver mais partes que cores). */
export const PART_COLORS = ['#F97335', '#FFB02E', '#1D9BF0', '#1F9D63', '#8B5CF6', '#E5484D', '#0EA5A4', '#B8481C', '#6D6962', '#C2410C'];

/** Roteiro em texto corrido (para copiar). */
export function scriptToText(title: string, d: ScriptData): string {
  const lines = [title, ''];
  let t = 0;
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
  d.parts.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name.toUpperCase()} · ${mmss(t)}–${mmss(t + p.seconds)} (${fmtSecs(p.seconds)})`);
    t += p.seconds;
    if (p.speech) lines.push(`Fala: ${p.speech}`);
    if (p.onScreen) lines.push(`Texto na tela: ${p.onScreen}`);
    if (p.visual) lines.push(`Visual: ${p.visual}`);
    lines.push('');
  });
  if (d.production) {
    if (d.production.rhythm) lines.push('RITMO E EDIÇÃO', d.production.rhythm, '');
    if (d.production.sources.length) lines.push('FONTES (rodapé dos números)', ...d.production.sources.map((x) => `- ${x}`), '');
    if (d.production.shortVersion) lines.push('VERSÃO CURTA', d.production.shortVersion, '');
  }
  if (d.caption) lines.push('LEGENDA', d.caption, '');
  if (d.hashtags.length) lines.push(d.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '));
  return lines.join('\n').trim();
}

/** Etapas do fluxo de produção do vídeo (colunas do kanban). */
export const STAGES = [
  { id: 'draft', label: 'Rascunho', color: '#8A857A' },
  { id: 'reviewed', label: 'Revisado', color: '#1D9BF0' },
  { id: 'recorded', label: 'Gravado', color: '#8B5CF6' },
  { id: 'edited', label: 'Editado', color: '#F59E0B' },
  { id: 'published', label: 'Publicado', color: '#1F9D63' },
] as const;
export type Stage = (typeof STAGES)[number]['id'];
/** Aceita o valor antigo "ready" (equivale a "revisado"). */
export const normStage = (s: string): Stage => (s === 'ready' ? 'reviewed' : STAGES.some((x) => x.id === s) ? (s as Stage) : 'draft');
export const stageOf = (s: string) => STAGES.find((x) => x.id === normStage(s))!;
