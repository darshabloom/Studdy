CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "availability";
--> statement-breakpoint
CREATE SCHEMA "bookings";
--> statement-breakpoint
CREATE SCHEMA "communications";
--> statement-breakpoint
CREATE SCHEMA "families";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "integration";
--> statement-breakpoint
CREATE SCHEMA "learning";
--> statement-breakpoint
CREATE SCHEMA "lessons";
--> statement-breakpoint
CREATE SCHEMA "migration";
--> statement-breakpoint
CREATE SCHEMA "organisations";
--> statement-breakpoint
CREATE SCHEMA "payments";
--> statement-breakpoint
CREATE SCHEMA "permissions";
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "resources";
--> statement-breakpoint
CREATE SCHEMA "services";
--> statement-breakpoint
CREATE SCHEMA "students";
--> statement-breakpoint
CREATE SCHEMA "support";
--> statement-breakpoint
CREATE SCHEMA "tutors";
--> statement-breakpoint
CREATE SEQUENCE "platform"."global_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10000001 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"actor_user_id" uuid,
	"actor_role_code" text,
	"active_workspace_code" text,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"original_value" jsonb,
	"new_value" jsonb,
	"risk_level" text DEFAULT 'low' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."auth_identity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"provider_type" text DEFAULT 'supabase' NOT NULL,
	"provider_subject_id" uuid NOT NULL,
	"provider_tenant" text,
	"authentication_email" text NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	"unlinked_at" timestamp with time zone,
	"unlink_reason_code" text
);
--> statement-breakpoint
CREATE TABLE "identity"."contact_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"contact_type_code" text NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"status_code" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "bookings"."intended_lesson_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'LR-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"student_subject_section_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"family_account_id" uuid,
	"status_code" text DEFAULT 'awaiting_responses' NOT NULL,
	"close_reason_code" text,
	"proposed_start_at" timestamp with time zone NOT NULL,
	"proposed_end_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"format_code" text NOT NULL,
	"time_zone" text NOT NULL,
	"notes_for_tutors" text,
	"decision_deadline_at" timestamp with time zone NOT NULL,
	"deadline_rule_version" integer NOT NULL,
	"sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "intended_lesson_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "ilr_status_check" CHECK ("bookings"."intended_lesson_requests"."status_code" in ('draft', 'awaiting_responses', 'ready_for_selection', 'fulfilled', 'closed')),
	CONSTRAINT "ilr_format_check" CHECK ("bookings"."intended_lesson_requests"."format_code" in ('online', 'in_person')),
	CONSTRAINT "ilr_time_order_check" CHECK ("bookings"."intended_lesson_requests"."proposed_end_at" > "bookings"."intended_lesson_requests"."proposed_start_at"),
	CONSTRAINT "ilr_duration_positive_check" CHECK ("bookings"."intended_lesson_requests"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit"."outbox_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"status_code" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_entries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "permissions"."role_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"workspace_code" text,
	"status_code" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "role_definitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform"."rule_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"setting_key" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"value" jsonb NOT NULL,
	"status_code" text DEFAULT 'current' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"provenance_note" text,
	CONSTRAINT "rule_settings_status_check" CHECK ("platform"."rule_settings"."status_code" in ('current', 'superseded'))
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
CREATE TABLE "audit"."status_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"from_status_code" text,
	"to_status_code" text NOT NULL,
	"actor_user_id" uuid,
	"reason_code" text,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
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
CREATE TABLE "bookings"."tutor_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text NOT NULL,
	"intended_lesson_request_id" uuid NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"service_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status_code" text DEFAULT 'sent' NOT NULL,
	"respond_by_at" timestamp with time zone NOT NULL,
	"deadline_rule_version" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"close_reason_code" text,
	"decline_reason_code" text,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "tutor_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "tutor_request_status_check" CHECK ("bookings"."tutor_requests"."status_code" in ('sent', 'accepted', 'selected', 'declined', 'expired', 'acceptance_withdrawn', 'closed')),
	CONSTRAINT "tutor_request_position_range" CHECK ("bookings"."tutor_requests"."position" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "availability"."tutor_time_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"tutor_profile_id" uuid NOT NULL,
	"tutor_request_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"reservation_type_code" text DEFAULT 'request_hold' NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason_code" text,
	CONSTRAINT "reservation_status_check" CHECK ("availability"."tutor_time_reservations"."status_code" in ('active', 'released')),
	CONSTRAINT "reservation_type_check" CHECK ("availability"."tutor_time_reservations"."reservation_type_code" in ('request_hold', 'booking_confirmed')),
	CONSTRAINT "reservation_time_order_check" CHECK ("availability"."tutor_time_reservations"."end_at" > "availability"."tutor_time_reservations"."start_at")
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
CREATE TABLE "identity"."user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_active_workspace_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."user_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"role_definition_id" uuid NOT NULL,
	"status_code" text DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"assignment_reason_code" text,
	"workspace_enabled" boolean DEFAULT true NOT NULL,
	"scope_type" text,
	"scope_id" uuid,
	"country_code" char(2),
	"organisation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"reference" text DEFAULT 'USER-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0') NOT NULL,
	"legal_name" text,
	"preferred_name" text,
	"family_name" text,
	"display_name" text NOT NULL,
	"date_of_birth" date,
	"country_code" char(2) NOT NULL,
	"region_code" text,
	"time_zone" text NOT NULL,
	"locale" text NOT NULL,
	"account_status_code" text DEFAULT 'active' NOT NULL,
	"retention_until" timestamp with time zone,
	"legal_hold_status" text,
	CONSTRAINT "users_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "audit"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."auth_identity_links" ADD CONSTRAINT "auth_identity_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."contact_points" ADD CONSTRAINT "contact_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families"."family_memberships" ADD CONSTRAINT "family_memberships_family_account_id_family_accounts_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families"."family_memberships" ADD CONSTRAINT "family_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" ADD CONSTRAINT "intended_lesson_requests_student_subject_section_id_student_subject_sections_id_fk" FOREIGN KEY ("student_subject_section_id") REFERENCES "students"."student_subject_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" ADD CONSTRAINT "intended_lesson_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" ADD CONSTRAINT "intended_lesson_requests_family_account_id_family_accounts_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "families"."family_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" ADD CONSTRAINT "intended_lesson_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."intended_lesson_requests" ADD CONSTRAINT "intended_lesson_requests_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."service_versions" ADD CONSTRAINT "service_versions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "platform"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."status_transitions" ADD CONSTRAINT "status_transitions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_requests_intended_lesson_request_id_intended_lesson_requests_id_fk" FOREIGN KEY ("intended_lesson_request_id") REFERENCES "bookings"."intended_lesson_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_requests_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_requests_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "services"."service_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings"."tutor_requests" ADD CONSTRAINT "tutor_requests_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ADD CONSTRAINT "tutor_time_reservations_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ADD CONSTRAINT "tutor_time_reservations_tutor_request_id_tutor_requests_id_fk" FOREIGN KEY ("tutor_request_id") REFERENCES "bookings"."tutor_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_verifications" ADD CONSTRAINT "tutor_verifications_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutors"."tutor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_definition_id_role_definitions_id_fk" FOREIGN KEY ("role_definition_id") REFERENCES "permissions"."role_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identity_links_active_subject_idx" ON "identity"."auth_identity_links" USING btree ("provider_type","provider_subject_id") WHERE "identity"."auth_identity_links"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "family_memberships_live_unique_idx" ON "families"."family_memberships" USING btree ("family_account_id","user_id") WHERE "families"."family_memberships"."status_code" = 'active';--> statement-breakpoint
CREATE INDEX "family_memberships_user_idx" ON "families"."family_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ilr_section_idx" ON "bookings"."intended_lesson_requests" USING btree ("student_subject_section_id");--> statement-breakpoint
CREATE INDEX "ilr_open_deadline_idx" ON "bookings"."intended_lesson_requests" USING btree ("decision_deadline_at") WHERE "bookings"."intended_lesson_requests"."status_code" in ('awaiting_responses', 'ready_for_selection');--> statement-breakpoint
CREATE UNIQUE INDEX "rule_settings_current_unique_idx" ON "platform"."rule_settings" USING btree ("setting_key") WHERE "platform"."rule_settings"."status_code" = 'current';--> statement-breakpoint
CREATE UNIQUE INDEX "rule_settings_key_version_unique_idx" ON "platform"."rule_settings" USING btree ("setting_key","version_number");--> statement-breakpoint
CREATE INDEX "student_profiles_user_id_idx" ON "students"."student_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profiles_family_idx" ON "students"."student_profiles" USING btree ("default_family_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_subject_sections_live_unique_idx" ON "students"."student_subject_sections" USING btree ("student_profile_id","subject_id") WHERE "students"."student_subject_sections"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_active_position_unique_idx" ON "students"."subject_section_shortlist_entries" USING btree ("student_subject_section_id","position") WHERE "students"."subject_section_shortlist_entries"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_active_tutor_unique_idx" ON "students"."subject_section_shortlist_entries" USING btree ("student_subject_section_id","tutor_profile_id") WHERE "students"."subject_section_shortlist_entries"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_request_live_position_unique_idx" ON "bookings"."tutor_requests" USING btree ("intended_lesson_request_id","position") WHERE "bookings"."tutor_requests"."status_code" in ('sent', 'accepted', 'selected');--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_request_live_tutor_unique_idx" ON "bookings"."tutor_requests" USING btree ("intended_lesson_request_id","tutor_profile_id") WHERE "bookings"."tutor_requests"."status_code" in ('sent', 'accepted', 'selected');--> statement-breakpoint
CREATE INDEX "tutor_request_tutor_idx" ON "bookings"."tutor_requests" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "tutor_request_open_deadline_idx" ON "bookings"."tutor_requests" USING btree ("respond_by_at") WHERE "bookings"."tutor_requests"."status_code" = 'sent';--> statement-breakpoint
CREATE INDEX "reservation_tutor_active_idx" ON "availability"."tutor_time_reservations" USING btree ("tutor_profile_id") WHERE "availability"."tutor_time_reservations"."status_code" = 'active';--> statement-breakpoint
CREATE INDEX "reservation_expiry_idx" ON "availability"."tutor_time_reservations" USING btree ("expires_at") WHERE "availability"."tutor_time_reservations"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_verifications_live_unique_idx" ON "tutors"."tutor_verifications" USING btree ("tutor_profile_id","label_code") WHERE "tutors"."tutor_verifications"."status_code" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_assignments_live_unique_idx" ON "identity"."user_role_assignments" USING btree ("user_id","role_definition_id") WHERE "identity"."user_role_assignments"."status_code" in ('active', 'pending');