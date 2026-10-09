CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" text DEFAULT 'upload' NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"thumb" "bytea",
	"size" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"description" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(description, '') || ' ' || coalesce(tags, ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_brand_idx" ON "assets" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_search_idx" ON "assets" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_brand_hash_idx" ON "assets" USING btree ("brand_id","content_hash");