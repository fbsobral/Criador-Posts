import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personaGroups, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { PersonaBoard } from './board';

export const metadata = { title: 'Personas' };

export default async function PersonasPage() {
  const c = (await getCtx())!;
  const [groups, people, [s]] = await Promise.all([
    db.select().from(personaGroups).where(eq(personaGroups.brandId, c.brandId)).orderBy(personaGroups.position, personaGroups.createdAt),
    db.select().from(personas).where(eq(personas.brandId, c.brandId)).orderBy(personas.position, personas.createdAt),
    db.select({ icp: brandSettings.personaIcp }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
  ]);
  return (
    <PersonaBoard
      groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
      people={people.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, groupId: p.groupId, data: p.data, source: p.source }))}
      icp={s?.icp ?? ''}
      hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'}
    />
  );
}
