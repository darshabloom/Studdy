CREATE TABLE "availability"."availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_profile_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"effect_code" text NOT NULL,
	"reason_code" text,
	"private_note" text,
	"is_private" boolean DEFAULT true NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "availability_exception_effect_check" CHECK ("availability"."availability_exceptions"."effect_code" in ('adds', 'removes')),
	CONSTRAINT "availability_exception_status_check" CHECK ("availability"."availability_exceptions"."status_code" in ('active', 'archived')),
	CONSTRAINT "availability_exception_time_order" CHECK ("availability"."availability_exceptions"."ends_at" > "availability"."availability_exceptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "availability"."availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_profile_id" uuid NOT NULL,
	"service_id" uuid,
	"subject_id" uuid,
	"lesson_format_code" text DEFAULT 'any' NOT NULL,
	"day_of_week" smallint NOT NULL,
	"local_start_time" time NOT NULL,
	"local_end_time" time NOT NULL,
	"iana_time_zone" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"minimum_notice_minutes" integer,
	"maximum_advance_booking_days" integer,
	"status_code" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "availability_rule_status_check" CHECK ("availability"."availability_rules"."status_code" in ('active', 'archived')),
	CONSTRAINT "availability_rule_format_check" CHECK ("availability"."availability_rules"."lesson_format_code" in ('online', 'in_person', 'any')),
	CONSTRAINT "availability_rule_day_range" CHECK ("availability"."availability_rules"."day_of_week" between 0 and 6),
	CONSTRAINT "availability_rule_time_order" CHECK ("availability"."availability_rules"."local_end_time" > "availability"."availability_rules"."local_start_time"),
	CONSTRAINT "availability_rule_effective_order" CHECK ("availability"."availability_rules"."effective_until" is null or "availability"."availability_rules"."effective_until" >= "availability"."availability_rules"."effective_from"),
	CONSTRAINT "availability_rule_notice_non_negative" CHECK ("availability"."availability_rules"."minimum_notice_minutes" is null or "availability"."availability_rules"."minimum_notice_minutes" >= 0),
	CONSTRAINT "availability_rule_advance_positive" CHECK ("availability"."availability_rules"."maximum_advance_booking_days" is null or "availability"."availability_rules"."maximum_advance_booking_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "availability"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_rules" ADD CONSTRAINT "availability_rules_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_rules" ADD CONSTRAINT "availability_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_rules" ADD CONSTRAINT "availability_rules_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_rules" ADD CONSTRAINT "availability_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."availability_rules" ADD CONSTRAINT "availability_rules_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exception_tutor_window_idx" ON "availability"."availability_exceptions" USING btree ("tutor_profile_id","starts_at","ends_at") WHERE "availability"."availability_exceptions"."status_code" = 'active';--> statement-breakpoint
CREATE INDEX "availability_rule_tutor_active_idx" ON "availability"."availability_rules" USING btree ("tutor_profile_id","day_of_week") WHERE "availability"."availability_rules"."status_code" = 'active';