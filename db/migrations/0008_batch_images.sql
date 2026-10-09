ALTER TABLE "generation_batches" ADD COLUMN "with_images" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_items" ADD COLUMN "image_count" integer DEFAULT 0 NOT NULL;