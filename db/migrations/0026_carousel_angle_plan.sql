ALTER TABLE "generation_batches" ADD COLUMN "angle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD COLUMN "plan" jsonb;