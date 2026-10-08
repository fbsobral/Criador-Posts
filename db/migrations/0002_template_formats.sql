ALTER TABLE "posts" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "editor" text DEFAULT 'carrossel' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
DELETE FROM "templates";--> statement-breakpoint
INSERT INTO "templates" ("name", "description", "editor") VALUES ('Carrossel Feed', 'Carrossel 1080×1350 com capa, texto, texto + imagem e imagem.', 'carrossel');--> statement-breakpoint
UPDATE "posts" SET "template_id" = (SELECT "id" FROM "templates" WHERE "editor" = 'carrossel' AND "brand_id" IS NULL LIMIT 1);
