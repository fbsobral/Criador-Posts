'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, indent, children }: { href: string; indent?: boolean; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link href={href} className={`nav${indent ? ' indent' : ''}${active ? ' active' : ''}`}>
      {children}
    </Link>
  );
}
