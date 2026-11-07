'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMemberRole, type Role } from '@/lib/user-admin-actions';

/** Admin da marca: muda o nível de um membro da organização atual. */
export function MemberRole({ userId, role }: { userId: string; role: Role }) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <span className="pu-role">
      <select value={value} disabled={pending} aria-label="Nível" onChange={(e) => {
        const v = e.target.value as Role, prev = value;
        setValue(v); setErr('');
        start(async () => { const r = await setMemberRole({ userId, role: v }); if (r.error) { setValue(prev); setErr(r.error); } else router.refresh(); });
      }}>
        <option value="org:member">Membro</option><option value="org:admin">Administrador</option>
      </select>
      {err && <small className="sb-error">{err}</small>}
    </span>
  );
}
