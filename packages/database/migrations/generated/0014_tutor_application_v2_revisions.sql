CREATE TABLE "tutors"."tutor_application_v2_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "revision_number" integer NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "snapshot" jsonb NOT NULL,
  "tutor_agreement_version" text NOT NULL,
  "code_of_conduct_version" text NOT NULL,
  "privacy_notice_version" text NOT NULL,
  "guardian_consent_reference" text,
  CONSTRAINT "tutor_application_v2_revision_number_check" CHECK ("tutors"."tutor_application_v2_revisions"."revision_number" >= 1),
  CONSTRAINT "tutor_application_v2_revision_snapshot_check" CHECK ("tutors"."tutor_application_v2_revisions"."snapshot" ->> 'schemaVersion' = '2')
);
--> statement-breakpoint
ALTER TABLE "tutors"."tutor_application_v2_revisions"
  ADD CONSTRAINT "tutor_application_v2_revisions_application_id_tutor_applications_id_fk"
  FOREIGN KEY ("application_id") REFERENCES "tutors"."tutor_applications"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_application_v2_revision_number_unique_idx" ON "tutors"."tutor_application_v2_revisions" USING btree ("application_id","revision_number");
