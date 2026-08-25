ALTER TABLE "tutors"."tutor_profiles" ADD COLUMN "minimum_gap_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ADD COLUMN "gap_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Drizzle emits `ADD COLUMN ... NOT NULL` with no default, which fails outright
-- on a table that already holds rows. Added with a temporary default, backfilled
-- from the lesson's own end (a zero gap, which is what those reservations were
-- taken under), then the default dropped so the final shape matches the schema
-- exactly and a later `db:generate` sees no drift.
--
-- Hand-completed before this file was ever applied anywhere. The immutability
-- rule protects migrations that have already run in a shared environment; none
-- has run this one.
ALTER TABLE "availability"."tutor_time_reservations" ADD COLUMN "effective_end_at" timestamp with time zone;--> statement-breakpoint
UPDATE "availability"."tutor_time_reservations" SET "effective_end_at" = "end_at" WHERE "effective_end_at" IS NULL;--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ALTER COLUMN "effective_end_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ADD CONSTRAINT "reservation_gap_minutes_check" CHECK ("availability"."tutor_time_reservations"."gap_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "availability"."tutor_time_reservations" ADD CONSTRAINT "reservation_effective_end_check" CHECK ("availability"."tutor_time_reservations"."effective_end_at" >= "availability"."tutor_time_reservations"."end_at");
