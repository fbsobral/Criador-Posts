import { cache } from 'react';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, users } from '@/db/schema';

export type Ctx = {
  userId: string;
  brandId: string;
  brandName: string;
  isBrandAdmin: boolean;
  isPlatformAdmin: boolean;
};

const platformAdmins = () =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/**
 * Resolve usuário + marca ativa (Organization do Clerk). Lê do banco e só chama a
 * API do Clerk (lenta) na primeira vez que vê o usuário ou a marca. Cacheado por request.
 * Obs.: renomear a organização no Clerk não atualiza o nome aqui automaticamente.
 */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId) return null;

  const [[userRow], [brandRow]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(brands).where(eq(brands.clerkOrgId, orgId)),
  ]);

  let email = userRow?.email ?? null;
  if (!userRow) {
    const user = await currentUser();
    email = user?.primaryEmailAddress?.emailAddress ?? null;
    await db
      .insert(users)
      .values({ id: userId, email, name: user?.fullName ?? null, imageUrl: user?.imageUrl ?? null })
      .onConflictDoNothing();
  }

  let brand = brandRow;
  if (!brand) {
    const org = await (await clerkClient()).organizations.getOrganization({ organizationId: orgId });
    [brand] = await db.insert(brands).values({ clerkOrgId: orgId, name: org.name }).onConflictDoUpdate({ target: brands.clerkOrgId, set: { name: org.name } }).returning();
    await db.insert(brandSettings).values({ brandId: brand.id, displayName: org.name }).onConflictDoNothing();
  }

  return {
    userId,
    brandId: brand.id,
    brandName: brand.name,
    isBrandAdmin: has({ role: 'org:admin' }),
    isPlatformAdmin: !!email && platformAdmins().includes(email.toLowerCase()),
  };
});

/** Só o necessário para saber se é admin da plataforma (não exige marca ativa). */
export async function isPlatformAdminUser(): Promise<boolean> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return !!email && platformAdmins().includes(email);
}

export const getBrandSettings = async (brandId: string) =>
  (await db.select().from(brandSettings).where(eq(brandSettings.brandId, brandId)))[0];
