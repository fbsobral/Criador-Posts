/** Ilustração de cada formato de template (editor). */
export function TemplateArt({ editor, className }: { editor: string; className?: string }) {
  if (editor === 'tweet') {
    return (
      <svg className={className} viewBox="0 0 46 58" fill="none">
        <rect width="46" height="58" rx="5" fill="#1B3F33" />
        <rect x="14" y="6" width="18" height="4" rx="2" fill="#F6F6F6" opacity=".85" />
        <rect x="6" y="18" width="34" height="30" rx="4" fill="#F6F6F6" />
        <circle cx="12" cy="24.5" r="3" fill="#F5B84A" />
        <rect x="17" y="22" width="12" height="2.2" rx="1.1" fill="#14382C" />
        <rect x="17" y="26" width="8" height="1.8" rx=".9" fill="#14382C" opacity=".4" />
        <rect x="9" y="33" width="28" height="2" rx="1" fill="#14382C" opacity=".8" />
        <rect x="9" y="37" width="20" height="2" rx="1" fill="#14382C" opacity=".8" />
        <rect x="9" y="43" width="28" height="1.5" rx=".7" fill="#BBD3CB" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 46 58" fill="none">
      <rect width="46" height="58" rx="5" fill="#FAF8F5" stroke="#E0DACC" />
      <circle cx="9" cy="9" r="3.5" fill="#F7B23E" />
      <rect x="15" y="7" width="14" height="2.4" rx="1.2" fill="#0A0A0A" />
      <rect x="15" y="11" width="9" height="1.8" rx=".9" fill="#0A0A0A" opacity=".35" />
      <rect x="6" y="20" width="32" height="3.2" rx="1.6" fill="#0A0A0A" />
      <rect x="6" y="26" width="24" height="3.2" rx="1.6" fill="#0A0A0A" />
      <rect x="6" y="33" width="34" height="1.8" rx=".9" fill="#1A1A1A" opacity=".5" />
      <rect x="6" y="38" width="28" height="1.8" rx=".9" fill="#1A1A1A" opacity=".5" />
      <rect x="6" y="44" width="34" height="8" rx="2.5" fill="#E7E2D3" />
    </svg>
  );
}
