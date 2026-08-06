CREATE TABLE "families"."family_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'FAM-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"display_name" text NOT NULL,
	"primary_country_code" char(2) NOT NULL,
	"region_code" text,
	"default_currency_code" char(3) NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "family_accounts_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "families"."family_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"family_account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_role_code" text NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"is_primary_guardian" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason_code" text,
	CONSTRAINT "family_memberships_status_check" CHECK ("families"."family_memberships"."status_code" in ('active', 'ended', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "services"."service_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"service_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"format_code" text DEFAULT 'online' NOT NULL,
	"status_code" text DEFAULT 'current' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'SERVICE-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"status_code" text DEFAULT 'published' NOT NULL,
	CONSTRAINT "services_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "students"."student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'STUDENT-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"user_id" uuid,
	"default_family_account_id" uuid,
	"preferred_name" text NOT NULL,
	"family_name" text,
	"status_code" text DEFAULT 'active' NOT NULL,
	"independence_status_code" text DEFAULT 'dependent' NOT NULL,
	"login_access_state_code" text DEFAULT 'no_login' NOT NULL,
	"school_year_code" text,
	"school_or_provider_name" text,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "student_profiles_reference_unique" UNIQUE("reference"),
	CONSTRAINT "student_profiles_independence_status_check" CHECK ("students"."student_profiles"."independence_status_code" in ('dependent', 'independent'))
);
--> statement-breakpoint
CREATE TABLE "students"."student_subject_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"student_profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"school_year_code" text,
	"format_preference_code" text DEFAULT 'either' NOT NULL,
	"goals" text,
	"support_summary" text,
	"status_code" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "students"."subject_section_shortlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"student_subject_section_id" uuid NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"note" text,
	CONSTRAINT "subject_section_shortlist_position_range" CHECK ("students"."subject_section_shortlist_entries"."position" between 1 and 3),
	CONSTRAINT "subject_section_shortlist_status_check" CHECK ("students"."subject_section_shortlist_entries"."status_code" in ('active', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "platform"."subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'TUTOR-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"user_id" uuid NOT NULL,
	"public_first_name" text NOT NULL,
	"headline" text,
	"teaching_approach" text,
	"status_code" text DEFAULT 'active' NOT NULL,
	"visibility_state_code" text DEFAULT 'public_recommended' NOT NULL,
	"source_type_code" text DEFAULT 'development_seed' NOT NULL,
	"year_level_from" integer,
	"year_level_to" integer,
	"offers_online" boolean DEFAULT true NOT NULL,
	"offers_in_person" boolean DEFAULT false NOT NULL,
	"availability_label_code" text DEFAULT 'accepting_new' NOT NULL,
	"completed_lesson_count" integer DEFAULT 0 NOT NULL,
	"rating_hundredths" integer,
	"is_new_to_studdy" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tutor_profiles_reference_unique" UNIQUE("reference"),
	CONSTRAINT "tutor_profiles_status_check" CHECK ("tutors"."tutor_profiles"."status_code" in ('applicant', 'under_review', 'more_information_required', 'approved', 'active', 'unlisted', 'restricted', 'suspended', 'departed')),
	CONSTRAINT "tutor_profiles_visibility_check" CHECK ("tutors"."tutor_profiles"."visibility_state_code" in ('public_recommended', 'public_reduced', 'recommendations_paused', 'unlisted', 'existing_only', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_profile_id" uuid NOT NULL,
	"label_code" text NOT NULL,
	"verified_at" timestamp with time zone,
	"status_code" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families"."family_memberships" ADD CONSTRAINT "family_memberships_family_account_id_family_accounts_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families"."family_memberships" ADD CONSTRAINT "family_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."service_versions" ADD CONSTRAINT "service_versions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_profiles" ADD CONSTRAINT "student_profiles_default_family_account_id_family_accounts_id_fk" FOREIGN KEY ("default_family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_profiles" ADD CONSTRAINT "student_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_profiles" ADD CONSTRAINT "student_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_subject_sections" ADD CONSTRAINT "student_subject_sections_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "students"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_subject_sections" ADD CONSTRAINT "student_subject_sections_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_subject_sections" ADD CONSTRAINT "student_subject_sections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."student_subject_sections" ADD CONSTRAINT "student_subject_sections_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."subject_section_shortlist_entries" ADD CONSTRAINT "subject_section_shortlist_entries_student_subject_section_id_student_subject_sections_id_fk" FOREIGN KEY ("student_subject_section_id") REFERENCES "students"."student_subject_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."subject_section_shortlist_entries" ADD CONSTRAINT "subject_section_shortlist_entries_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students"."subject_section_shortlist_entries" ADD CONSTRAINT "subject_section_shortlist_entries_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_verifications" ADD CONSTRAINT "tutor_verifications_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "family_memberships_live_unique_idx" ON "families"."family_memberships" USING btree ("family_account_id","user_id") WHERE "families"."family_memberships"."status_code" = 'active';--> statement-breakpoint
CREATE INDEX "family_memberships_user_idx" ON "families"."family_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profiles_user_id_idx" ON "students"."student_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profiles_family_idx" ON "students"."student_profiles" USING btree ("default_family_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_subject_sections_live_unique_idx" ON "students"."student_subject_sections" USING btree ("student_profile_id","subject_id") WHERE "students"."student_subject_sections"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_active_position_unique_idx" ON "students"."subject_section_shortlist_entries" USING btree ("student_subject_section_id","position") WHERE "students"."subject_section_shortlist_entries"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_active_tutor_unique_idx" ON "students"."subject_section_shortlist_entries" USING btree ("student_subject_section_id","tutor_profile_id") WHERE "students"."subject_section_shortlist_entries"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_verifications_live_unique_idx" ON "tutors"."tutor_verifications" USING btree ("tutor_profile_id","label_code") WHERE "tutors"."tutor_verifications"."status_code" = 'active';