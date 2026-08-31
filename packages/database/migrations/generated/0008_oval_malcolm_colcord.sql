CREATE TABLE "payments"."connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_profile_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"account_type_code" text NOT NULL,
	"status_code" text DEFAULT 'not_onboarded' NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"transfers_capability_code" text DEFAULT 'inactive' NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"requirements_currently_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_past_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_disabled_reason" text,
	"requirements_current_deadline" timestamp with time zone,
	"onboarding_started_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"provider_synced_at" timestamp with time zone,
	"last_provider_event_at" timestamp with time zone,
	CONSTRAINT "connected_accounts_provider_account_id_unique" UNIQUE("provider_account_id"),
	CONSTRAINT "connected_account_status_check" CHECK ("payments"."connected_accounts"."status_code" in ('not_onboarded', 'pending', 'complete', 'restricted')),
	CONSTRAINT "connected_account_type_check" CHECK ("payments"."connected_accounts"."account_type_code" in ('express')),
	CONSTRAINT "connected_account_transfers_capability_check" CHECK ("payments"."connected_accounts"."transfers_capability_code" in ('active', 'inactive', 'pending'))
);
--> statement-breakpoint
ALTER TABLE "payments"."tutor_transfers" ADD COLUMN "connected_account_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments"."connected_accounts" ADD CONSTRAINT "connected_accounts_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_live_per_tutor_unique_idx" ON "payments"."connected_accounts" USING btree ("tutor_profile_id") WHERE "payments"."connected_accounts"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "connected_account_tutor_idx" ON "payments"."connected_accounts" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "connected_account_status_idx" ON "payments"."connected_accounts" USING btree ("status_code") WHERE "payments"."connected_accounts"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "payments"."tutor_transfers" ADD CONSTRAINT "tutor_transfers_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "payments"."connected_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_transfer_connected_account_idx" ON "payments"."tutor_transfers" USING btree ("connected_account_id");