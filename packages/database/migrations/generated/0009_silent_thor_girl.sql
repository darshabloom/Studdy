CREATE TABLE "communications"."notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"outbox_entry_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"recipient_role_code" text NOT NULL,
	"recipient_user_id" uuid,
	"to_address" text NOT NULL,
	"channel_code" text DEFAULT 'email' NOT NULL,
	"template_code" text NOT NULL,
	"status_code" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"provider" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "notification_deliveries_provider_message_id_unique" UNIQUE("provider_message_id"),
	CONSTRAINT "notification_deliveries_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "notification_delivery_status_check" CHECK ("communications"."notification_deliveries"."status_code" in ('pending', 'sent', 'failed')),
	CONSTRAINT "notification_delivery_role_check" CHECK ("communications"."notification_deliveries"."recipient_role_code" in ('family', 'tutor', 'ops')),
	CONSTRAINT "notification_delivery_channel_check" CHECK ("communications"."notification_deliveries"."channel_code" in ('email')),
	CONSTRAINT "notification_delivery_attempts_check" CHECK ("communications"."notification_deliveries"."attempts" >= 0),
	CONSTRAINT "notification_delivery_sent_complete_check" CHECK ("communications"."notification_deliveries"."status_code" <> 'sent'
      or ("communications"."notification_deliveries"."provider_message_id" is not null and "communications"."notification_deliveries"."sent_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "communications"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_outbox_entry_id_outbox_entries_id_fk" FOREIGN KEY ("outbox_entry_id") REFERENCES "audit"."outbox_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_recipient_unique_idx" ON "communications"."notification_deliveries" USING btree ("outbox_entry_id","recipient_role_code");--> statement-breakpoint
CREATE INDEX "notification_delivery_pending_idx" ON "communications"."notification_deliveries" USING btree ("status_code","created_at") WHERE "communications"."notification_deliveries"."status_code" in ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "notification_delivery_entry_idx" ON "communications"."notification_deliveries" USING btree ("outbox_entry_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_recipient_user_idx" ON "communications"."notification_deliveries" USING btree ("recipient_user_id");