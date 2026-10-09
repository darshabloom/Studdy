CREATE TABLE "bookings"."bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'BK-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"intended_lesson_request_id" uuid NOT NULL,
	"selected_tutor_request_id" uuid NOT NULL,
	"payment_id" uuid,
	"reservation_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"student_subject_section_id" uuid NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"family_account_id" uuid,
	"booked_by_user_id" uuid NOT NULL,
	"service_version_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"status_code" text DEFAULT 'confirmed' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"iana_time_zone" text NOT NULL,
	"local_date" date NOT NULL,
	"local_start_time" time NOT NULL,
	"lesson_format_code" text NOT NULL,
	"currency_code" char(3) NOT NULL,
	"lesson_amount_minor" bigint NOT NULL,
	"total_charged_minor" bigint NOT NULL,
	"platform_fee_amount_minor" bigint NOT NULL,
	"tutor_entitlement_minor" bigint NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "booking_status_check" CHECK ("bookings"."bookings"."status_code" in ('pending_payment', 'confirmed', 'cancelled', 'completed')),
	CONSTRAINT "booking_time_order_check" CHECK ("bookings"."bookings"."scheduled_end_at" > "bookings"."bookings"."scheduled_start_at"),
	CONSTRAINT "booking_duration_positive_check" CHECK ("bookings"."bookings"."duration_minutes" > 0),
	CONSTRAINT "booking_format_check" CHECK ("bookings"."bookings"."lesson_format_code" in ('online', 'in_person')),
	CONSTRAINT "booking_currency_check" CHECK ("bookings"."bookings"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "booking_amounts_check" CHECK ("bookings"."bookings"."lesson_amount_minor" >= 0
        and "bookings"."bookings"."platform_fee_amount_minor" >= 0
        and "bookings"."bookings"."tutor_entitlement_minor" >= 0
        and "bookings"."bookings"."platform_fee_amount_minor" + "bookings"."bookings"."tutor_entitlement_minor" = "bookings"."bookings"."lesson_amount_minor"
        and "bookings"."bookings"."total_charged_minor" >= "bookings"."bookings"."lesson_amount_minor"),
	CONSTRAINT "booking_status_timestamps_check" CHECK (("bookings"."bookings"."status_code" <> 'confirmed' or "bookings"."bookings"."confirmed_at" is not null)
        and ("bookings"."bookings"."status_code" <> 'cancelled' or "bookings"."bookings"."cancelled_at" is not null)
        and ("bookings"."bookings"."status_code" <> 'completed' or "bookings"."bookings"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_intended_lesson_request_id_intended_lesson_requests_id_fk" FOREIGN KEY ("intended_lesson_request_id") REFERENCES "bookings"."intended_lesson_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_selected_tutor_request_id_tutor_requests_id_fk" FOREIGN KEY ("selected_tutor_request_id") REFERENCES "bookings"."tutor_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_reservation_id_tutor_time_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "availability"."tutor_time_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "students"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_student_subject_section_id_student_subject_sections_id_fk" FOREIGN KEY ("student_subject_section_id") REFERENCES "students"."student_subject_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_family_account_id_family_accounts_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_booked_by_user_id_users_id_fk" FOREIGN KEY ("booked_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "services"."service_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."bookings" ADD CONSTRAINT "bookings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_selected_tutor_request_unique_idx" ON "bookings"."bookings" USING btree ("selected_tutor_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payment_unique_idx" ON "bookings"."bookings" USING btree ("payment_id") WHERE "bookings"."bookings"."payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_reservation_unique_idx" ON "bookings"."bookings" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "booking_tutor_start_idx" ON "bookings"."bookings" USING btree ("tutor_profile_id","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "booking_student_start_idx" ON "bookings"."bookings" USING btree ("student_profile_id","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "booking_family_start_idx" ON "bookings"."bookings" USING btree ("family_account_id","scheduled_start_at") WHERE "bookings"."bookings"."family_account_id" is not null;--> statement-breakpoint
CREATE INDEX "booking_confirmed_end_idx" ON "bookings"."bookings" USING btree ("scheduled_end_at") WHERE "bookings"."bookings"."status_code" = 'confirmed';