import Link from 'next/link';
import { IconBack } from '../icons';

/** Cabeçalho padrão das páginas do admin: voltar (opcional), título, descrição e ações à direita. */
export function PageHead({ title, description, back, actions }: {
  title: React.ReactNode; description?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {back && <Link href={back.href} className="back"><IconBack /> {back.label}</Link>}
        <h1 style={back ? { marginTop: 6 } : undefined}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row-actions">{actions}</div>}
    </div>
  );
}

/** Estado vazio padrão: ícone opcional, título, explicação e a ação principal. */
export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-ic">{icon}</div>}
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
