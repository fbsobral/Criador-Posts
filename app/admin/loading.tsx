/** Mostrado pelo Next enquanto uma página do admin carrega. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="spinner" />
      <span>Carregando…</span>
    </div>
  );
}
