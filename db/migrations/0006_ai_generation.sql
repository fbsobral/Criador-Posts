CREATE TYPE "public"."generation_item_status" AS ENUM('queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TABLE "generation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"template_id" uuid,
	"mode" text DEFAULT 'tema' NOT NULL,
	"slides_target" integer DEFAULT 7 NOT NULL,
	"facts" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"brief" text NOT NULL,
	"status" "generation_item_status" DEFAULT 'queued' NOT NULL,
	"post_id" uuid,
	"notes" jsonb,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_niche" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_audience" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_voice" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_rules" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_cta" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_examples" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_items" ADD CONSTRAINT "generation_items_batch_id_generation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."generation_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_items" ADD CONSTRAINT "generation_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_items" ADD CONSTRAINT "generation_items_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_batches_brand_idx" ON "generation_batches" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_items_batch_idx" ON "generation_items" USING btree ("batch_id","status");--> statement-breakpoint
CREATE INDEX "generation_items_brand_idx" ON "generation_items" USING btree ("brand_id","created_at");