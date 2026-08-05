/**
 * Platform feature flags — the approved set of eight from Technical
 * Architecture §10.1 (a superset of Blueprint §26's three).
 *
 * Flags gate availability, not architecture: disabled features keep their
 * routes, schemas and modules in place so enabling them requires no
 * structural reorganisation (brief §5).
 */
export const FEATURE_FLAGS = [
  'instant_booking',
  'group_lessons',
  'resource_marketplace',
  'embedded_lesson_room',
  'student_direct_booking',
  'organisation_workspace',
  'advanced_matching',
  'multiple_guardians',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/**
 * Static defaults for package one. A platform-configuration store replaces
 * this in a later slice; the call-site contract stays the same.
 */
const DEFAULTS: Record<FeatureFlag, boolean> = {
  instant_booking: false,
  group_lessons: false,
  resource_marketplace: false,
  embedded_lesson_room: false,
  student_direct_booking: false,
  organisation_workspace: false,
  advanced_matching: false,
  multiple_guardians: false,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return DEFAULTS[flag];
}
