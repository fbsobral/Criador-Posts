ALTER TABLE "brand_settings" ADD COLUMN "ai_caption_rules" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "caption" text DEFAULT '' NOT NULL;