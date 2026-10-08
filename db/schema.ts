import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Tema de cores do carrossel (mesmo formato usado pelo editor). */
export type Theme = Record<string, string>;

/** Aparência aplicada a um carrossel: tema, fonte e largura do texto. */
export type Style = { theme: Theme; font: string; width: string };

/** Conteúdo bruto de um post, no formato do editor (`g` globais + `slides`). */
export type PostData = { v: number; g: Record<string, unknown>; slides: unknown[] | null };

/** Espelho dos usuários do Clerk (a fonte de verdade continua sendo o Clerk). */
export const users = pgTable('users', {
  id: text('id').primaryKey(), // clerk user id
  email: text('email'),
  name: text('name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Marca = tenant. Cada marca corresponde a uma Organization do Clerk. */
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkOrgId: text('clerk_org_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('brands_clerk_org_id_idx').on(t.clerkOrgId)],
);

/** Configurações da marca: perfil e cabeçalho padrão dos posts + estilo padrão. */
export const brandSettings = pgTable('brand_settings', {
  brandId: uuid('brand_id').primaryKey().references(() => brands.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull().default(''),
  handle: text('handle').notNull().default(''),
  topic: text('topic').notNull().default(''),
  year: text('year').notNull().default(''),
  avatarUrl: text('avatar_url'),
  style: jsonb('style').$type<Style | null>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Templates de estilo. `brandId` nulo = template global da plataforma. */
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    style: jsonb('style').$type<Style>().notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('templates_brand_idx').on(t.brandId)],
);

export const postStatus = pgEnum('post_status', ['draft', 'published']);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Sem título'),
    status: postStatus('status').notNull().default('draft'),
    data: jsonb('data').$type<PostData>().notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('posts_brand_idx').on(t.brandId, t.updatedAt)],
);
