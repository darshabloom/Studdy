CREATE TABLE "services"."service_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"service_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"outcome_code" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"tutor_message" text,
	"internal_note" text,
	CONSTRAINT "service_reviews_outcome_check" CHECK ("services"."service_reviews"."outcome_code" in ('pending', 'approved', 'changes_requested', 'withdrawn')),
	CONSTRAINT "service_reviews_decision_check" CHECK ("services"."service_reviews"."outcome_code" not in ('approved', 'changes_requested') or ("services"."service_reviews"."decided_at" is not null and "services"."service_reviews"."decided_by_user_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "communications"."notification_deliveries" DROP CONSTRAINT "notification_delivery_role_check";--> statement-breakpoint
ALTER TABLE "services"."services" ALTER COLUMN "status_code" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "services"."services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "services"."services" ADD COLUMN "year_level_from" integer;--> statement-breakpoint
ALTER TABLE "services"."services" ADD COLUMN "year_level_to" integer;--> statement-breakpoint
ALTER TABLE "services"."services" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services"."services" ADD COLUMN "replaces_service_id" uuid;--> statement-breakpoint
ALTER TABLE "tutors"."tutor_profiles" ADD COLUMN "visibility_before_pause_code" text;--> statement-breakpoint
ALTER TABLE "services"."service_reviews" ADD CONSTRAINT "service_reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."service_reviews" ADD CONSTRAINT "service_reviews_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services"."service_reviews" ADD CONSTRAINT "service_reviews_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "identity"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_reviews_service_idx" ON "services"."service_reviews" USING btree ("service_id","submitted_at");--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_replaces_service_id_services_id_fk" FOREIGN KEY ("replaces_service_id") REFERENCES "services"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_tutor_status_idx" ON "services"."services" USING btree ("tutor_profile_id","status_code");--> statement-breakpoint
ALTER TABLE "communications"."notification_deliveries" ADD CONSTRAINT "notification_delivery_role_check" CHECK ("communications"."notification_deliveries"."recipient_role_code" in ('family', 'tutor', 'applicant', 'ops'));--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_status_check" CHECK ("services"."services"."status_code" in ('draft', 'pending_approval', 'changes_requested', 'approved', 'published', 'unpublished', 'archived'));--> statement-breakpoint
ALTER TABLE "services"."services" ADD CONSTRAINT "services_year_levels_check" CHECK ("services"."services"."year_level_from" is null or "services"."services"."year_level_to" is null or "services"."services"."year_level_from" <= "services"."services"."year_level_to");