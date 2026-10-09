CREATE TABLE "image_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" text,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"aspect_ratio" text DEFAULT '1:1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "ai_image_style" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_generations_brand_idx" ON "image_generations" USING btree ("brand_id","created_at");