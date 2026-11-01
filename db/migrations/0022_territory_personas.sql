CREATE TABLE "territory_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"territory_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"translation" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "territories" DROP CONSTRAINT "territories_persona_id_personas_id_fk";
--> statement-breakpoint
ALTER TABLE "territory_personas" ADD CONSTRAINT "territory_personas_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_personas" ADD CONSTRAINT "territory_personas_territory_id_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_personas" ADD CONSTRAINT "territory_personas_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "territory_personas_pair_idx" ON "territory_personas" USING btree ("territory_id","persona_id");--> statement-breakpoint
CREATE INDEX "territory_personas_brand_idx" ON "territory_personas" USING btree ("brand_id","persona_id");--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Migração dos mapas por persona: cada território passa a estar ligado à persona que era dona dele (sem tradução ainda). Os do "Público geral" (persona nula) viram temas macro, sem ligação. A ligação é copiada ANTES de a origem virar "set null".
INSERT INTO "territory_personas" ("brand_id", "territory_id", "persona_id", "source")
SELECT "brand_id", "id", "persona_id", "source" FROM "territories" WHERE "persona_id" IS NOT NULL
ON CONFLICT DO NOTHING;
