-- Bootstrap: PostgreSQL extensions only. Runs before generated migrations
-- (see src/migrate.ts ordering). Named schemas and the global reference
-- sequence are owned by the Drizzle-generated migrations, which create each
-- schema the first time it gains objects.
-- Reviewed SQL: immutable once applied to a shared environment.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";
