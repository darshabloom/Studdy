CREATE TABLE "bookings"."request_time_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"intended_lesson_request_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"local_start_time" time NOT NULL,
	"iana_time_zone" text NOT NULL,
	"status_code" text DEFAULT 'offered' NOT NULL,
	CONSTRAINT "request_time_option_position_unique" UNIQUE("intended_lesson_request_id","position"),
	CONSTRAINT "request_time_option_status_check" CHECK ("bookings"."request_time_options"."status_code" in ('offered', 'taken', 'lapsed', 'withdrawn')),
	CONSTRAINT "request_time_option_time_order" CHECK ("bookings"."request_time_options"."ends_at" > "bookings"."request_time_options"."starts_at"),
	CONSTRAINT "request_time_option_position_range" CHECK ("bookings"."request_time_options"."position" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "bookings"."tutor_request_time_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_request_id" uuid NOT NULL,
	"request_time_option_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status_code" text DEFAULT 'offered' NOT NULL,
	"claimed_at" timestamp with time zone,
	"unavailable_detected_at" timestamp with time zone,
	CONSTRAINT "tutor_request_time_option_unique" UNIQUE("tutor_request_id","request_time_option_id"),
	CONSTRAINT "tutor_request_time_option_status_check" CHECK ("bookings"."tutor_request_time_options"."status_code" in ('offered', 'claimed', 'unavailable', 'lapsed')),
	CONSTRAINT "tutor_request_time_option_time_order" CHECK ("bookings"."tutor_request_time_options"."ends_at" > "bookings"."tutor_request_time_options"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" DROP CONSTRAINT "ilr_time_order_check";--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "accepted_time_option_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "acceptance_hold_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "hold_rule_version" integer;--> statement-breakpoint
ALTER TABLE "bookings"."request_time_options" ADD CONSTRAINT "request_time_options_intended_lesson_request_id_intended_lesson_requests_id_fk" FOREIGN KEY ("intended_lesson_request_id") REFERENCES "bookings"."intended_lesson_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_request_time_options" ADD CONSTRAINT "tutor_request_time_options_tutor_request_id_tutor_requests_id_fk" FOREIGN KEY ("tutor_request_id") REFERENCES "bookings"."tutor_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_request_time_options" ADD CONSTRAINT "tutor_request_time_options_request_time_option_id_request_time_options_id_fk" FOREIGN KEY ("request_time_option_id") REFERENCES "bookings"."request_time_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_time_option_request_idx" ON "bookings"."request_time_options" USING btree ("intended_lesson_request_id");--> statement-breakpoint
CREATE INDEX "request_time_option_open_start_idx" ON "bookings"."request_time_options" USING btree ("starts_at") WHERE "bookings"."request_time_options"."status_code" = 'offered';--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_request_time_option_one_claim" ON "bookings"."tutor_request_time_options" USING btree ("tutor_request_id") WHERE "bookings"."tutor_request_time_options"."status_code" = 'claimed';--> statement-breakpoint
CREATE INDEX "tutor_request_time_option_request_idx" ON "bookings"."tutor_request_time_options" USING btree ("tutor_request_id");--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" DROP COLUMN "proposed_start_at";--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" DROP COLUMN "proposed_end_at";