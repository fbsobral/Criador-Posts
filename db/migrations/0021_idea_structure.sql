ALTER TABLE "content_ideas" ADD COLUMN "impact" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "cause" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "plan" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "gain" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD COLUMN "desire" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "content_ideas" SET "plan" = (SELECT coalesce(string_agg(v, E'\n'), '') FROM jsonb_array_elements_text("args") AS v) WHERE jsonb_array_length("args") > 0;--> statement-breakpoint
ALTER TABLE "content_ideas" DROP COLUMN "args";
