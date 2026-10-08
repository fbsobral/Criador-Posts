'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link href={href} className={`nav${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
