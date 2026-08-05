import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * The named PostgreSQL schemas (Database spec §2). Ordinary application
 * tables never live in `public`; it holds approved public views, extensions
 * and reviewed compatibility functions only.
 *
 * Schema objects are declared here once; tables attach to them from their
 * module directories as slices land.
 */
export const identitySchema = pgSchema('identity');
export const familiesSchema = pgSchema('families');
export const studentsSchema = pgSchema('students');
export const tutorsSchema = pgSchema('tutors');
export const organisationsSchema = pgSchema('organisations');
export const servicesSchema = pgSchema('services');
export const availabilitySchema = pgSchema('availability');
export const bookingsSchema = pgSchema('bookings');
export const paymentsSchema = pgSchema('payments');
export const lessonsSchema = pgSchema('lessons');
export const learningSchema = pgSchema('learning');
export const resourcesSchema = pgSchema('resources');
export const communicationsSchema = pgSchema('communications');
export const supportSchema = pgSchema('support');
export const permissionsSchema = pgSchema('permissions');
export const platformSchema = pgSchema('platform');
export const auditSchema = pgSchema('audit');
export const integrationSchema = pgSchema('integration');
export const migrationSchema = pgSchema('migration');
