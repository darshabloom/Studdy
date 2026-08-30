ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "payment_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "payment_window_minutes" integer;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "payment_window_rule_version" integer;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "near_lesson_cutoff_minutes" integer;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD COLUMN "near_lesson_cutoff_rule_version" integer;--> statement-breakpoint
CREATE INDEX "tutor_request_payment_deadline_idx" ON "bookings"."tutor_requests" USING btree ("payment_deadline_at") WHERE "bookings"."tutor_requests"."status_code" = 'selected';--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_request_payment_window_positive_check" CHECK ("bookings"."tutor_requests"."payment_window_minutes" is null or "bookings"."tutor_requests"."payment_window_minutes" > 0);--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_request_near_lesson_cutoff_check" CHECK ("bookings"."tutor_requests"."near_lesson_cutoff_minutes" is null or "bookings"."tutor_requests"."near_lesson_cutoff_minutes" >= 0);