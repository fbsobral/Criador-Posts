import { sql } from 'drizzle-orm';
import { boolean, customType, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

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
  /** @ de cada rede (o editor exporta uma versão por conta). */
  instagram: text('instagram').notNull().default(''),
  tiktok: text('tiktok').notNull().default(''),
  x: text('x').notNull().default(''),
  topic: text('topic').notNull().default(''),
  year: text('year').notNull().default(''),
  avatarUrl: text('avatar_url'),
  style: jsonb('style').$type<Style | null>(),
  /** Identidade da marca usada pela IA em toda geração. */
  aiNiche: text('ai_niche').notNull().default(''),
  aiAudience: text('ai_audience').notNull().default(''),
  aiVoice: text('ai_voice').notNull().default(''),
  aiRules: text('ai_rules').notNull().default(''),
  aiCta: text('ai_cta').notNull().default(''),
  aiExamples: text('ai_examples').notNull().default(''),
  /** Estilo visual das imagens geradas (ex.: "fotografia realista, tons quentes, sem pessoas"). */
  aiImageStyle: text('ai_image_style').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Templates = formatos de post. Cada um aponta para um editor (`editor`), que define
 * a estrutura dos slides. `brandId` nulo = formato global da plataforma.
 */
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    editor: text('editor').notNull().default('carrossel'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('templates_brand_idx').on(t.brandId)],
);

/** Conjuntos de cores salvos pela marca (aparecem em "Cores do template" no editor). */
export const colorPalettes = pgTable(
  'color_palettes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    editor: text('editor').notNull().default('carrossel'),
    name: text('name').notNull(),
    theme: jsonb('theme').$type<Theme>().notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('color_palettes_brand_idx').on(t.brandId)],
);

export const postStatus = pgEnum('post_status', ['draft', 'published']);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'restrict' }),
    /** Post de origem quando este foi criado por conversão de formato. */
    sourcePostId: uuid('source_post_id'),
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

export const itemStatus = pgEnum('generation_item_status', ['queued', 'running', 'done', 'error']);

/** Lote de geração com IA (vários posts de uma vez). */
export const generationBatches = pgTable(
  'generation_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    /** 'tema' = a IA escreve; 'roteiro' = a IA só estrutura o texto enviado. */
    mode: text('mode').notNull().default('tema'),
    slidesTarget: integer('slides_target').notNull().default(7),
    /** Gerar também as imagens (Nano Banana) dos slides. */
    withImages: boolean('with_images').notNull().default(false),
    /** Briefing de imagens deste lote (somado ao da marca; vai para cada post gerado). */
    imageBrief: text('image_brief').notNull().default(''),
    facts: text('facts').notNull().default(''),
    instructions: text('instructions').notNull().default(''),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('generation_batches_brand_idx').on(t.brandId, t.createdAt)],
);

/** Um post a gerar dentro do lote. */
export const generationItems = pgTable(
  'generation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id').notNull().references(() => generationBatches.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    brief: text('brief').notNull(),
    status: itemStatus('status').notNull().default('queued'),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
    /** Sugestões de imagem por slide (a IA descreve, você insere). */
    notes: jsonb('notes').$type<string[]>(),
    error: text('error'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    imageCount: integer('image_count').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('generation_items_batch_idx').on(t.batchId, t.status), index('generation_items_brand_idx').on(t.brandId, t.createdAt)],
);

/** Registro de cada imagem gerada com IA (auditoria e limite diário por marca). */
export const imageGenerations = pgTable(
  'image_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    aspectRatio: text('aspect_ratio').notNull().default('1:1'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('image_generations_brand_idx').on(t.brandId, t.createdAt)],
);

/**
 * Galeria de imagens da marca (geradas com IA ou enviadas). Os posts guardam só a referência
 * (`/api/assets/:id`), não os bytes. `search` é uma coluna de busca de texto em português.
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('upload'), // 'ai' | 'upload'
    mime: text('mime').notNull(),
    bytes: bytea('bytes').notNull(),
    thumb: bytea('thumb'),
    size: integer('size').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    /** Descrição da imagem (para IA: o prompt usado). */
    description: text('description').notNull().default(''),
    /** Palavras-chave separadas por espaço (minúsculas). */
    tags: text('tags').notNull().default(''),
    contentHash: text('content_hash').notNull(),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    search: tsvector('search').generatedAlwaysAs(sql`to_tsvector('portuguese', coalesce(description, '') || ' ' || coalesce(tags, ''))`),
  },
  (t) => [
    index('assets_brand_idx').on(t.brandId, t.createdAt),
    index('assets_search_idx').using('gin', t.search),
    uniqueIndex('assets_brand_hash_idx').on(t.brandId, t.contentHash),
  ],
);
