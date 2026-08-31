CREATE TABLE "payments"."payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payment_id" uuid,
	"status_code" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_note" text,
	CONSTRAINT "payment_events_provider_event_id_unique" UNIQUE("provider_event_id"),
	CONSTRAINT "payment_event_status_check" CHECK ("payments"."payment_events"."status_code" in ('received', 'applied', 'ignored', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "payments"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'PAY-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"intended_lesson_request_id" uuid NOT NULL,
	"tutor_request_id" uuid NOT NULL,
	"service_version_id" uuid NOT NULL,
	"payer_user_id" uuid NOT NULL,
	"family_account_id" uuid,
	"tutor_profile_id" uuid NOT NULL,
	"currency_code" char(3) NOT NULL,
	"lesson_amount_minor" bigint NOT NULL,
	"platform_fee_rate_bps" integer NOT NULL,
	"platform_fee_rule_version" integer NOT NULL,
	"platform_fee_amount_minor" bigint NOT NULL,
	"tutor_entitlement_minor" bigint NOT NULL,
	"processing_fee_payer_code" text NOT NULL,
	"processing_fee_rule_version" integer NOT NULL,
	"processing_fee_charged_minor" bigint DEFAULT 0 NOT NULL,
	"total_charged_minor" bigint NOT NULL,
	"provider_cost_minor" bigint,
	"tax_treatment_code" text,
	"tax_metadata" jsonb,
	"provider" text,
	"provider_payment_intent_id" text,
	"provider_charge_id" text,
	"provider_balance_transaction_id" text,
	"status_code" text DEFAULT 'requires_payment' NOT NULL,
	"payment_deadline_at" timestamp with time zone NOT NULL,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"last_failure_code" text,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refund_required_at" timestamp with time zone,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference"),
	CONSTRAINT "payments_provider_payment_intent_id_unique" UNIQUE("provider_payment_intent_id"),
	CONSTRAINT "payment_status_check" CHECK ("payments"."payments"."status_code" in ('requires_payment', 'processing', 'succeeded', 'failed', 'cancelled', 'expired')),
	CONSTRAINT "payment_processing_fee_payer_check" CHECK ("payments"."payments"."processing_fee_payer_code" in ('platform', 'payer')),
	CONSTRAINT "payment_currency_check" CHECK ("payments"."payments"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payment_fee_split_check" CHECK ("payments"."payments"."lesson_amount_minor" = "payments"."payments"."platform_fee_amount_minor" + "payments"."payments"."tutor_entitlement_minor"),
	CONSTRAINT "payment_total_check" CHECK ("payments"."payments"."total_charged_minor" = "payments"."payments"."lesson_amount_minor" + "payments"."payments"."processing_fee_charged_minor"),
	CONSTRAINT "payment_platform_absorbs_check" CHECK ("payments"."payments"."processing_fee_payer_code" <> 'platform' or "payments"."payments"."processing_fee_charged_minor" = 0),
	CONSTRAINT "payment_amounts_non_negative_check" CHECK ("payments"."payments"."lesson_amount_minor" >= 0
      and "payments"."payments"."platform_fee_amount_minor" >= 0
      and "payments"."payments"."tutor_entitlement_minor" >= 0
      and "payments"."payments"."processing_fee_charged_minor" >= 0
      and "payments"."payments"."total_charged_minor" >= 0
      and ("payments"."payments"."provider_cost_minor" is null or "payments"."payments"."provider_cost_minor" >= 0)),
	CONSTRAINT "payment_fee_rate_range_check" CHECK ("payments"."payments"."platform_fee_rate_bps" between 0 and 10000),
	CONSTRAINT "payment_attempts_non_negative_check" CHECK ("payments"."payments"."failed_attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments"."tutor_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"payment_id" uuid NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"status_code" text DEFAULT 'pending' NOT NULL,
	"provider_transfer_id" text,
	"sent_at" timestamp with time zone,
	"failure_note" text,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "tutor_transfers_provider_transfer_id_unique" UNIQUE("provider_transfer_id"),
	CONSTRAINT "tutor_transfers_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "tutor_transfer_status_check" CHECK ("payments"."tutor_transfers"."status_code" in ('pending', 'sent', 'failed', 'reversed')),
	CONSTRAINT "tutor_transfer_amount_check" CHECK ("payments"."tutor_transfers"."amount_minor" >= 0),
	CONSTRAINT "tutor_transfer_currency_check" CHECK ("payments"."tutor_transfers"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "payments"."payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_intended_lesson_request_id_intended_lesson_requests_id_fk" FOREIGN KEY ("intended_lesson_request_id") REFERENCES "bookings"."intended_lesson_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_tutor_request_id_tutor_requests_id_fk" FOREIGN KEY ("tutor_request_id") REFERENCES "bookings"."tutor_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "services"."service_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_family_account_id_family_accounts_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."tutor_transfers" ADD CONSTRAINT "tutor_transfers_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."tutor_transfers" ADD CONSTRAINT "tutor_transfers_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_event_pending_idx" ON "payments"."payment_events" USING btree ("status_code","received_at") WHERE "payments"."payment_events"."status_code" in ('received', 'failed');--> statement-breakpoint
CREATE INDEX "payment_event_payment_idx" ON "payments"."payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_live_per_request_unique_idx" ON "payments"."payments" USING btree ("intended_lesson_request_id") WHERE "payments"."payments"."status_code" in ('requires_payment', 'processing', 'succeeded');--> statement-breakpoint
CREATE INDEX "payment_tutor_idx" ON "payments"."payments" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "payment_request_idx" ON "payments"."payments" USING btree ("intended_lesson_request_id");--> statement-breakpoint
CREATE INDEX "payment_open_deadline_idx" ON "payments"."payments" USING btree ("payment_deadline_at") WHERE "payments"."payments"."status_code" in ('requires_payment', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_transfer_live_per_payment_unique_idx" ON "payments"."tutor_transfers" USING btree ("payment_id") WHERE "payments"."tutor_transfers"."status_code" in ('pending', 'sent');--> statement-breakpoint
CREATE INDEX "tutor_transfer_pending_idx" ON "payments"."tutor_transfers" USING btree ("status_code","created_at") WHERE "payments"."tutor_transfers"."status_code" = 'pending';--> statement-breakpoint
CREATE INDEX "tutor_transfer_tutor_idx" ON "payments"."tutor_transfers" USING btree ("tutor_profile_id");