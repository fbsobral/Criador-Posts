const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "há 5 minutos", "ontem"… */
export function timeAgo(date: Date): string {
  const s = Math.round((date.getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of steps) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  return 'agora mesmo';
}

/** Texto puro de um trecho de HTML do editor (aceita HTML cortado no meio de uma tag). */
export function plain(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<img[^>]*>?/gi, ' ')
    .replace(/<\/(p|h2|li|div)>/gi, '\n')
    .replace(/<[^>]*>?/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

export const initials = (name?: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

/** Texto puro numa linha (aceita HTML do editor ou texto simples). */
export const plainText = (v: string) => plain(v).replace(/\s+/g, ' ').trim();
