import { PART_COLORS, fmtSecs } from '@/lib/video';

/** Linha do tempo do vídeo: uma faixa por parte, com largura proporcional ao tempo. */
export function PartsBar({ parts, small }: { parts: { name: string; seconds: number }[]; small?: boolean }) {
  return (
    <div className={`vd-bar${small ? ' sm' : ''}`} role="img" aria-label={parts.map((p) => `${p.name} ${fmtSecs(p.seconds)}`).join(', ')}>
      {parts.map((p, i) => (
        <div key={i} className="vd-seg" style={{ flex: Math.max(1, p.seconds), background: PART_COLORS[i % PART_COLORS.length] }} title={`${p.name} · ${fmtSecs(p.seconds)}`}>
          {!small && <><span>{p.name}</span><small>{fmtSecs(p.seconds)}</small></>}
        </div>
      ))}
    </div>
  );
}
