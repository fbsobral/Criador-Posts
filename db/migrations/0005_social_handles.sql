ALTER TABLE "brand_settings" ADD COLUMN "instagram" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "tiktok" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "x" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "brand_settings" SET "instagram" = "handle" WHERE "handle" <> '' AND "instagram" = '';
