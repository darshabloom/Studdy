CREATE TABLE "identity"."user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_active_workspace_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN "family_name" text;--> statement-breakpoint
ALTER TABLE "identity"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_assignments_live_unique_idx" ON "identity"."user_role_assignments" USING btree ("user_id","role_definition_id") WHERE "identity"."user_role_assignments"."status_code" in ('active', 'pending');