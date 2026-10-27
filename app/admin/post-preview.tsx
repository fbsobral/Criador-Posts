import { plain } from '@/lib/format';

type Theme = Record<string, string | undefined>;

export type PreviewData = {
  editor: string;
  theme: Theme | null; // carrossel: g.theme
  colors: Theme | null; // tweet: g.colors
  text: string | null; // trecho do 1º slide
};

/** Miniatura estilizada do post (usa as cores e o texto reais do 1º slide). */
export function PostPreview({ editor, theme, colors, text }: PreviewData) {
  const body = plain(text);
  const [first, ...rest] = body.split('\n');

  if (editor === 'tweet') {
    const c = { bg: '#1B3F33', card: '#F6F6F6', text: '#14382C', accent2: '#5CC49A', ...(colors ?? {}) };
    return (
      <div className="pv" style={{ background: c.bg }}>
        <div className="tlogo" style={{ background: c.card }} />
        <div className="tcard" style={{ background: c.card, color: c.text }}>
          <div className="who"><div className="av" /><div style={{ flex: 1 }}><div className="nm" /><div className="hd" /></div></div>
          <p>{body || 'Novo post'}</p>
          <div style={{ height: 3, background: c.text, opacity: 0.12, borderRadius: 2 }} />
        </div>
      </div>
    );
  }

  if (editor === 'noticia') {
    const c = { bg: '#000000', title: '#FFFFFF', text: '#FFFFFF', tagbg: '#3C4966', tagtext: '#E6EAF2', badge: '#3C4966', ...(colors ?? {}) };
    return (
      <div className="pv" style={{ background: `linear-gradient(to top, ${c.bg} 38%, #3a3a3a)`, padding: '9%', justifyContent: 'flex-end', gap: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '8%', top: '7%', width: 18, height: 18, borderRadius: '50%', background: c.badge }} />
        <span style={{ alignSelf: 'flex-start', fontSize: 6, letterSpacing: '.12em', background: c.tagbg, color: c.tagtext, borderRadius: 99, padding: '2px 7px' }}>NOTÍCIA</span>
        <h4 style={{ color: c.title, margin: 0 }}>{first || 'Novo post'}</h4>
        {rest.length > 0 && <p style={{ color: c.text, margin: 0 }}>{rest.join(' ')}</p>}
      </div>
    );
  }

  const t = { bg: '#FAF8F5', title: '#0A0A0A', text: '#1A1A1A', ...(theme ?? {}) };
  return (
    <div className="pv" style={{ background: t.bg, color: t.title }}>
      <div className="who"><div className="av" /><div style={{ flex: 1 }}><div className="nm" /><div className="hd" /></div></div>
      <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        <h4 style={{ color: t.title }}>{first || 'Novo post'}</h4>
        {rest.length > 0 && <p style={{ color: t.text, marginTop: 8 }}>{rest.join(' ')}</p>}
      </div>
    </div>
  );
}
