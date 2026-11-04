'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { onboardingSeen } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { GUIDE_KEYS } from '@/lib/guides';

/** Marca um guia (tour geral ou de um módulo) como visto por este usuário. */
export async function markGuideSeen(key: string): Promise<{ error?: string }> {
  const c = await getCtx();
  if (!c) return { error: 'Não autorizado' };
  if (!GUIDE_KEYS.includes(key)) return { error: 'Guia desconhecido.' };
  try {
    await db.insert(onboardingSeen).values({ userId: c.userId, key }).onConflictDoNothing();
    return {};
  } catch {
    return { error: 'Não foi possível salvar. O guia pode aparecer de novo.' };
  }
}

/** Faz todos os guias voltarem a aparecer para este usuário. */
export async function resetGuides(): Promise<{ error?: string }> {
  const c = await getCtx();
  if (!c) return { error: 'Não autorizado' };
  try {
    await db.delete(onboardingSeen).where(and(eq(onboardingSeen.userId, c.userId)));
    return {};
  } catch {
    return { error: 'Não foi possível reiniciar os guias.' };
  }
}
