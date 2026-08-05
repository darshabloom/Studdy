-- Bootstrap: extensions, named schemas and the global reference sequence.
-- Runs before generated migrations (see src/migrate.ts ordering).
-- Reviewed SQL: immutable once applied to a shared environment.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- Named schemas (Database spec §2). Generated migrations also create the
-- schemas they use; creating the full set here keeps privileges consistent
-- and lets reviewed SQL reference any schema safely.
create schema if not exists "identity";
create schema if not exists "families";
create schema if not exists "students";
create schema if not exists "tutors";
create schema if not exists "organisations";
create schema if not exists "services";
create schema if not exists "availability";
create schema if not exists "bookings";
create schema if not exists "payments";
create schema if not exists "lessons";
create schema if not exists "learning";
create schema if not exists "resources";
create schema if not exists "communications";
create schema if not exists "support";
create schema if not exists "permissions";
create schema if not exists "platform";
create schema if not exists "audit";
create schema if not exists "integration";
create schema if not exists "migration";

-- One concurrency-safe global sequence feeding every human-readable
-- reference (USER-…, FAM-…, BOOK-…, Database spec §3).
create sequence if not exists platform.global_reference_seq
  as bigint
  increment by 1
  start with 10000001
  no cycle;
