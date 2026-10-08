import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import('./index');
  const { templates } = await import('./schema');
  const { GLOBAL_PRESETS } = await import('../lib/themes');
  const { isNull } = await import('drizzle-orm');

  const existing = await db.select({ name: templates.name }).from(templates).where(isNull(templates.brandId));
  const have = new Set(existing.map((t) => t.name));
  const missing = GLOBAL_PRESETS.filter((p) => !have.has(p.name));
  if (missing.length) {
    await db.insert(templates).values(
      missing.map((p) => ({ name: p.name, style: { theme: p.theme, font: 'Inter', width: '860' } })),
    );
  }
  console.log(`Templates globais: +${missing.length} (total ${have.size + missing.length})`);
  process.exit(0);
}
main();
