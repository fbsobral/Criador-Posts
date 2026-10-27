ALTER TABLE "brand_settings" ADD COLUMN "priority_config" jsonb;--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN "score_reason" text DEFAULT '' NOT NULL;