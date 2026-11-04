CREATE TABLE "onboarding_seen" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_seen_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "onboarding_seen" ADD CONSTRAINT "onboarding_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;