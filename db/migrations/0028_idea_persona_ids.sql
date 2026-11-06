ALTER TABLE "content_ideas" ADD COLUMN "persona_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
-- ideias que já existem: a lista começa com a persona que elas já tinham
UPDATE "content_ideas" SET "persona_ids" = ARRAY["persona_id"] WHERE "persona_id" IS NOT NULL;
