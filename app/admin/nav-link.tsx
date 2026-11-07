'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActive } from './nav-config';

export function NavLink({ href, icon, children, exclude = [], also = [], exact = false }: { href: string; icon: React.ReactNode; children: React.ReactNode; exclude?: string[]; also?: string[]; exact?: boolean }) {
  const path = usePathname();
  const active = isActive(path, { href, exclude, also, exact });
  return (
    <Link href={href} className={`nav${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
