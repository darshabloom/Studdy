CREATE TABLE "payments"."refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'RF-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"reason_code" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"status_code" text DEFAULT 'requested' NOT NULL,
	"provider" text,
	"provider_refund_id" text,
	"provider_status" text,
	"failure_code" text,
	"idempotency_key" text NOT NULL,
	"requested_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "refunds_reference_unique" UNIQUE("reference"),
	CONSTRAINT "refunds_provider_refund_id_unique" UNIQUE("provider_refund_id"),
	CONSTRAINT "refunds_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "refund_status_check" CHECK ("payments"."refunds"."status_code" in ('requested', 'pending', 'succeeded', 'failed')),
	CONSTRAINT "refund_reason_check" CHECK ("payments"."refunds"."reason_code" in ('booking_not_confirmed')),
	CONSTRAINT "refund_amount_positive_check" CHECK ("payments"."refunds"."amount_minor" > 0),
	CONSTRAINT "refund_currency_check" CHECK ("payments"."refunds"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "refund_attempt_positive_check" CHECK ("payments"."refunds"."attempt" >= 1),
	CONSTRAINT "refund_provider_answered_check" CHECK ("payments"."refunds"."status_code" not in ('pending', 'succeeded') or "payments"."refunds"."provider_refund_id" is not null),
	CONSTRAINT "refund_completed_check" CHECK ("payments"."refunds"."status_code" not in ('succeeded', 'failed') or "payments"."refunds"."completed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refund_attempt_unique_idx" ON "payments"."refunds" USING btree ("payment_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_live_per_payment_unique_idx" ON "payments"."refunds" USING btree ("payment_id") WHERE "payments"."refunds"."status_code" in ('requested', 'pending', 'succeeded');--> statement-breakpoint
CREATE INDEX "refund_unsettled_idx" ON "payments"."refunds" USING btree ("status_code","requested_at") WHERE "payments"."refunds"."status_code" in ('requested', 'pending');