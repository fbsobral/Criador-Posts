'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, icon, children, exclude = [] }: { href: string; icon: React.ReactNode; children: React.ReactNode; exclude?: string[] }) {
  const path = usePathname();
  const active = path.startsWith(href) && !exclude.some((x) => path.startsWith(x));
  return (
    <Link href={href} className={`nav${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
