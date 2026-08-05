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
ALTER TABLE "audit"."status_transitions" ADD CONSTRAINT "status_transitions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_definition_id_role_definitions_id_fk" FOREIGN KEY ("role_definition_id") REFERENCES "permissions"."role_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identity_links_active_subject_idx" ON "identity"."auth_identity_links" USING btree ("provider_type","provider_subject_id") WHERE "identity"."auth_identity_links"."status_code" = 'active';