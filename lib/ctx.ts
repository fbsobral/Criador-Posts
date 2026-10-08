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
 * Resolve usuário + marca ativa (Organization do Clerk) e garante as linhas
 * correspondentes no banco. Retorna null se não houver login ou marca ativa.
 */
export async function getCtx(): Promise<Ctx | null> {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId) return null;

  const [user, org] = await Promise.all([currentUser(), (await clerkClient()).organizations.getOrganization({ organizationId: orgId })]);
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  await db
    .insert(users)
    .values({ id: userId, email, name: user?.fullName ?? null, imageUrl: user?.imageUrl ?? null })
    .onConflictDoUpdate({ target: users.id, set: { email, name: user?.fullName ?? null, imageUrl: user?.imageUrl ?? null } });

  const [brand] = await db
    .insert(brands)
    .values({ clerkOrgId: orgId, name: org.name })
    .onConflictDoUpdate({ target: brands.clerkOrgId, set: { name: org.name } })
    .returning();
  await db.insert(brandSettings).values({ brandId: brand.id, displayName: org.name }).onConflictDoNothing();

  return {
    userId,
    brandId: brand.id,
    brandName: brand.name,
    isBrandAdmin: has({ role: 'org:admin' }),
    isPlatformAdmin: !!email && platformAdmins().includes(email.toLowerCase()),
  };
}

/** Só o necessário para saber se é admin da plataforma (não exige marca ativa). */
export async function isPlatformAdminUser(): Promise<boolean> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return !!email && platformAdmins().includes(email);
}

export const getBrandSettings = async (brandId: string) =>
  (await db.select().from(brandSettings).where(eq(brandSettings.brandId, brandId)))[0];
