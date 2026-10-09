CREATE TABLE "tutors"."tutor_application_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"application_id" uuid NOT NULL,
	"check_code" text NOT NULL,
	"status_code" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"checked_by_user_id" uuid,
	"checked_at" timestamp with time zone,
	CONSTRAINT "tutor_application_check_code_check" CHECK ("tutors"."tutor_application_checks"."check_code" in ('identity', 'safeguarding', 'references', 'interview')),
	CONSTRAINT "tutor_application_check_status_check" CHECK ("tutors"."tutor_application_checks"."status_code" in ('pending', 'verified', 'failed')),
	CONSTRAINT "tutor_application_check_attributed_check" CHECK ("tutors"."tutor_application_checks"."status_code" = 'pending' or ("tutors"."tutor_application_checks"."checked_by_user_id" is not null and "tutors"."tutor_application_checks"."checked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_application_revision_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"relationship" text NOT NULL,
	CONSTRAINT "tutor_application_reference_position_check" CHECK ("tutors"."tutor_application_revision_references"."position" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_application_revision_subjects" (
	"revision_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "tutor_application_revision_subjects_revision_id_subject_id_pk" PRIMARY KEY("revision_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_application_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"application_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legal_first_name" text NOT NULL,
	"legal_family_name" text NOT NULL,
	"preferred_first_name" text NOT NULL,
	"phone" text,
	"headline" text NOT NULL,
	"teaching_approach" text NOT NULL,
	"experience_summary" text NOT NULL,
	"qualifications_summary" text,
	"year_level_from" integer NOT NULL,
	"year_level_to" integer NOT NULL,
	"offers_online" boolean NOT NULL,
	"offers_in_person" boolean NOT NULL,
	"declarations_version" text NOT NULL,
	"declarations_accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tutor_application_revision_number_check" CHECK ("tutors"."tutor_application_revisions"."revision_number" >= 1),
	CONSTRAINT "tutor_application_revision_years_check" CHECK ("tutors"."tutor_application_revisions"."year_level_from" between 1 and 13 and "tutors"."tutor_application_revisions"."year_level_to" between 1 and 13 and "tutors"."tutor_application_revisions"."year_level_from" <= "tutors"."tutor_application_revisions"."year_level_to"),
	CONSTRAINT "tutor_application_revision_format_check" CHECK ("tutors"."tutor_application_revisions"."offers_online" or "tutors"."tutor_application_revisions"."offers_in_person")
);
--> statement-breakpoint
CREATE TABLE "tutors"."tutor_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'APP-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"status_code" text DEFAULT 'draft' NOT NULL,
	"draft" jsonb,
	"current_revision_number" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"applicant_message" text,
	"internal_note" text,
	"approved_revision_number" integer,
	"tutor_profile_id" uuid,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "tutor_applications_reference_unique" UNIQUE("reference"),
	CONSTRAINT "tutor_application_status_check" CHECK ("tutors"."tutor_applications"."status_code" in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'withdrawn')),
	CONSTRAINT "tutor_application_revision_check" CHECK ("tutors"."tutor_applications"."current_revision_number" >= 0),
	CONSTRAINT "tutor_application_submitted_has_revision_check" CHECK ("tutors"."tutor_applications"."status_code" in ('draft', 'withdrawn') or "tutors"."tutor_applications"."current_revision_number" >= 1),
	CONSTRAINT "tutor_application_approved_complete_check" CHECK ("tutors"."tutor_applications"."status_code" <> 'approved' or ("tutors"."tutor_applications"."tutor_profile_id" is not null and "tutors"."tutor_applications"."approved_revision_number" is not null and "tutors"."tutor_applications"."decided_at" is not null and "tutors"."tutor_applications"."decided_by_user_id" is not null)),
	CONSTRAINT "tutor_application_decided_check" CHECK ("tutors"."tutor_applications"."status_code" not in ('rejected', 'changes_requested') or ("tutors"."tutor_applications"."decided_at" is not null and "tutors"."tutor_applications"."decided_by_user_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_checks" ADD CONSTRAINT "tutor_application_checks_application_id_tutor_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "tutors"."tutor_applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_checks" ADD CONSTRAINT "tutor_application_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_revision_references" ADD CONSTRAINT "tutor_application_revision_references_revision_id_tutor_application_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "tutors"."tutor_application_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_revision_subjects" ADD CONSTRAINT "tutor_application_revision_subjects_revision_id_tutor_application_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "tutors"."tutor_application_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_revision_subjects" ADD CONSTRAINT "tutor_application_revision_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_revisions" ADD CONSTRAINT "tutor_application_revisions_application_id_tutor_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "tutors"."tutor_applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_applications" ADD CONSTRAINT "tutor_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_applications" ADD CONSTRAINT "tutor_applications_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_applications" ADD CONSTRAINT "tutor_applications_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_application_check_unique_idx" ON "tutors"."tutor_application_checks" USING btree ("application_id","check_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_application_reference_position_unique_idx" ON "tutors"."tutor_application_revision_references" USING btree ("revision_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_application_revision_number_unique_idx" ON "tutors"."tutor_application_revisions" USING btree ("application_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_application_live_per_applicant_unique_idx" ON "tutors"."tutor_applications" USING btree ("applicant_user_id") WHERE "tutors"."tutor_applications"."status_code" in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved');--> statement-breakpoint
CREATE INDEX "tutor_application_review_queue_idx" ON "tutors"."tutor_applications" USING btree ("submitted_at") WHERE "tutors"."tutor_applications"."status_code" in ('submitted', 'under_review');