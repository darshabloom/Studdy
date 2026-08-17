import { and, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../client';
import {
  authIdentityLinks,
  availabilityExceptions,
  availabilityRules,
  services,
  serviceVersions,
  subjects,
  tutorProfiles,
  tutorVerifications,
} from '../../schema/index';

/**
 * Seeded subjects and approved tutors for discovery (brief §13).
 *
 * Every profile carries source_type_code = 'development_seed'. That code is
 * deliberately NOT exposed by the public view; the interface labels example
 * tutors instead, so they can never be mistaken for real people.
 */

const SUBJECT_SEED = [
  { code: 'mathematics', displayName: 'Mathematics', sortOrder: 10 },
  { code: 'english', displayName: 'English', sortOrder: 20 },
  { code: 'science', displayName: 'Science', sortOrder: 30 },
  { code: 'calculus', displayName: 'Calculus', sortOrder: 40 },
  { code: 'physics', displayName: 'Physics', sortOrder: 50 },
  { code: 'chemistry', displayName: 'Chemistry', sortOrder: 60 },
  { code: 'biology', displayName: 'Biology', sortOrder: 70 },
] as const;

interface TutorSeed {
  email: string;
  publicFirstName: string;
  headline: string;
  teachingApproach: string;
  statusCode: string;
  visibilityStateCode: string;
  yearLevelFrom: number;
  yearLevelTo: number;
  offersOnline: boolean;
  offersInPerson: boolean;
  availabilityLabelCode: string;
  completedLessonCount: number;
  ratingHundredths: number | null;
  isNewToStuddy: boolean;
  verifications: readonly string[];
  services: ReadonlyArray<{
    subjectCode: string;
    displayName: string;
    durationMinutes: number;
    priceAmountMinor: number;
    formatCode: string;
  }>;
  /**
   * Recurring bookable time, chosen to match the tutor's availability label so
   * the label and the real calculated slots agree. A tutor advertised as
   * "available this week" who has no bookable time would be a lie the seed told.
   */
  availability: ReadonlyArray<{
    /** 0 = Sunday … 6 = Saturday. */
    dayOfWeek: number;
    localStartTime: string;
    localEndTime: string;
  }>;
}

const SEED_TIME_ZONE = 'Pacific/Auckland';
const SEED_EFFECTIVE_FROM = '2026-01-01';

const TUTOR_SEED: readonly TutorSeed[] = [
  {
    email: 'tutor.a@local.studdy.test',
    publicFirstName: 'Aroha',
    headline: 'Maths made calm and clear',
    teachingApproach:
      'I start by finding the gap that is actually causing the trouble, then rebuild confidence from there. Lessons are relaxed, practical and full of worked examples.',
    statusCode: 'active',
    visibilityStateCode: 'public_recommended',
    yearLevelFrom: 7,
    yearLevelTo: 10,
    offersOnline: true,
    offersInPerson: false,
    availabilityLabelCode: 'available_this_week',
    completedLessonCount: 0,
    ratingHundredths: null,
    isNewToStuddy: true,
    verifications: ['identity_verified', 'studdy_interviewed'],
    services: [
      {
        subjectCode: 'mathematics',
        displayName: 'Mathematics tutoring (Years 7–10)',
        durationMinutes: 60,
        priceAmountMinor: 3500,
        formatCode: 'online',
      },
    ],
    availability: [
      { dayOfWeek: 1, localStartTime: '16:00', localEndTime: '19:00' },
      { dayOfWeek: 2, localStartTime: '16:00', localEndTime: '19:00' },
      { dayOfWeek: 3, localStartTime: '16:00', localEndTime: '19:00' },
      { dayOfWeek: 4, localStartTime: '16:00', localEndTime: '19:00' },
      { dayOfWeek: 5, localStartTime: '15:00', localEndTime: '18:00' },
    ],
  },
  {
    email: 'tutor.b@local.studdy.test',
    publicFirstName: 'James',
    headline: 'NCEA and Cambridge maths specialist',
    teachingApproach:
      'Twelve years teaching senior mathematics. I work backwards from the assessment so students know exactly what is being asked of them, and why each method works.',
    statusCode: 'active',
    visibilityStateCode: 'public_recommended',
    yearLevelFrom: 10,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: true,
    availabilityLabelCode: 'limited',
    completedLessonCount: 312,
    ratingHundredths: 490,
    isNewToStuddy: false,
    verifications: [
      'identity_verified',
      'qualification_verified',
      'references_completed',
      'studdy_interviewed',
    ],
    services: [
      {
        subjectCode: 'mathematics',
        displayName: 'Senior Mathematics',
        durationMinutes: 60,
        priceAmountMinor: 5500,
        formatCode: 'online',
      },
      {
        subjectCode: 'calculus',
        displayName: 'Calculus (Years 12–13)',
        durationMinutes: 60,
        priceAmountMinor: 6000,
        formatCode: 'either',
      },
    ],
    availability: [
      { dayOfWeek: 2, localStartTime: '17:00', localEndTime: '19:00' },
      { dayOfWeek: 4, localStartTime: '17:00', localEndTime: '19:00' },
    ],
  },
  {
    email: 'tutor.c@local.studdy.test',
    publicFirstName: 'Mei',
    headline: 'Writing, reading and exam technique',
    teachingApproach:
      'Essays, close reading and confident writing. We work on structure first, then voice — most students find the writing gets easier once the plan is solid.',
    statusCode: 'active',
    visibilityStateCode: 'public_recommended',
    yearLevelFrom: 7,
    yearLevelTo: 12,
    offersOnline: true,
    offersInPerson: false,
    availabilityLabelCode: 'accepting_new',
    completedLessonCount: 88,
    ratingHundredths: 470,
    isNewToStuddy: false,
    verifications: ['identity_verified', 'qualification_verified', 'studdy_interviewed'],
    services: [
      {
        subjectCode: 'english',
        displayName: 'English tutoring (Years 7–12)',
        durationMinutes: 60,
        priceAmountMinor: 4000,
        formatCode: 'online',
      },
    ],
    availability: [
      { dayOfWeek: 1, localStartTime: '15:00', localEndTime: '18:00' },
      { dayOfWeek: 3, localStartTime: '15:00', localEndTime: '18:00' },
      { dayOfWeek: 5, localStartTime: '15:00', localEndTime: '18:00' },
    ],
  },
  {
    // Negative fixture: suspended tutors must never reach public discovery.
    email: 'restricted.tutor@local.studdy.test',
    publicFirstName: 'Riley',
    headline: 'Should never appear in public discovery',
    teachingApproach: 'Suspended fixture used to prove the public exposure boundary holds.',
    statusCode: 'suspended',
    visibilityStateCode: 'suspended',
    yearLevelFrom: 7,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: true,
    availabilityLabelCode: 'existing_only',
    completedLessonCount: 5,
    ratingHundredths: 300,
    isNewToStuddy: false,
    verifications: [],
    services: [
      {
        subjectCode: 'mathematics',
        displayName: 'Mathematics (suspended fixture)',
        durationMinutes: 60,
        priceAmountMinor: 1000,
        formatCode: 'online',
      },
    ],
    availability: [{ dayOfWeek: 1, localStartTime: '16:00', localEndTime: '17:00' }],
  },
];

export async function seedDiscoveryTutors(): Promise<void> {
  const { sql, db } = createDatabaseClient();
  try {
    for (const subject of SUBJECT_SEED) {
      await db.insert(subjects).values(subject).onConflictDoNothing({ target: subjects.code });
    }
    const subjectRows = await db.select().from(subjects);
    const subjectIdByCode = new Map(subjectRows.map((row) => [row.code, row.id]));

    for (const seed of TUTOR_SEED) {
      const [link] = await db
        .select({ userId: authIdentityLinks.userId })
        .from(authIdentityLinks)
        .where(eq(authIdentityLinks.authenticationEmail, seed.email));
      if (link === undefined) {
        console.warn(`skipping tutor seed, no user for ${seed.email}`);
        continue;
      }

      const [existingProfile] = await db
        .select({ id: tutorProfiles.id })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, link.userId));

      let tutorProfileId: string;
      if (existingProfile !== undefined) {
        tutorProfileId = existingProfile.id;
        await db
          .update(tutorProfiles)
          .set({
            publicFirstName: seed.publicFirstName,
            headline: seed.headline,
            teachingApproach: seed.teachingApproach,
            statusCode: seed.statusCode,
            visibilityStateCode: seed.visibilityStateCode,
            yearLevelFrom: seed.yearLevelFrom,
            yearLevelTo: seed.yearLevelTo,
            offersOnline: seed.offersOnline,
            offersInPerson: seed.offersInPerson,
            availabilityLabelCode: seed.availabilityLabelCode,
            completedLessonCount: seed.completedLessonCount,
            ratingHundredths: seed.ratingHundredths,
            isNewToStuddy: seed.isNewToStuddy,
            updatedAt: new Date(),
          })
          .where(eq(tutorProfiles.id, tutorProfileId));
      } else {
        const [created] = await db
          .insert(tutorProfiles)
          .values({
            userId: link.userId,
            publicFirstName: seed.publicFirstName,
            headline: seed.headline,
            teachingApproach: seed.teachingApproach,
            statusCode: seed.statusCode,
            visibilityStateCode: seed.visibilityStateCode,
            sourceTypeCode: 'development_seed',
            yearLevelFrom: seed.yearLevelFrom,
            yearLevelTo: seed.yearLevelTo,
            offersOnline: seed.offersOnline,
            offersInPerson: seed.offersInPerson,
            availabilityLabelCode: seed.availabilityLabelCode,
            completedLessonCount: seed.completedLessonCount,
            ratingHundredths: seed.ratingHundredths,
            isNewToStuddy: seed.isNewToStuddy,
          })
          .returning({ id: tutorProfiles.id });
        if (created === undefined) throw new Error('tutor profile insert returned no row');
        tutorProfileId = created.id;
      }

      for (const label of seed.verifications) {
        const [existing] = await db
          .select({ id: tutorVerifications.id })
          .from(tutorVerifications)
          .where(
            and(
              eq(tutorVerifications.tutorProfileId, tutorProfileId),
              eq(tutorVerifications.labelCode, label),
            ),
          );
        if (existing === undefined) {
          await db.insert(tutorVerifications).values({
            tutorProfileId,
            labelCode: label,
            verifiedAt: new Date('2026-06-01T00:00:00.000Z'),
          });
        }
      }

      for (const service of seed.services) {
        const subjectId = subjectIdByCode.get(service.subjectCode);
        if (subjectId === undefined) throw new Error(`unknown subject ${service.subjectCode}`);
        const [existingService] = await db
          .select({ id: services.id })
          .from(services)
          .where(
            and(eq(services.tutorProfileId, tutorProfileId), eq(services.subjectId, subjectId)),
          );
        let serviceId: string;
        if (existingService !== undefined) {
          serviceId = existingService.id;
        } else {
          const [created] = await db
            .insert(services)
            .values({ tutorProfileId, subjectId, displayName: service.displayName })
            .returning({ id: services.id });
          if (created === undefined) throw new Error('service insert returned no row');
          serviceId = created.id;
        }

        const [existingVersion] = await db
          .select({ id: serviceVersions.id })
          .from(serviceVersions)
          .where(
            and(
              eq(serviceVersions.serviceId, serviceId),
              eq(serviceVersions.statusCode, 'current'),
            ),
          );
        if (existingVersion === undefined) {
          await db.insert(serviceVersions).values({
            serviceId,
            durationMinutes: service.durationMinutes,
            priceAmountMinor: BigInt(service.priceAmountMinor),
            currencyCode: 'NZD',
            formatCode: service.formatCode,
          });
        }
      }
      // Recurring availability. Idempotent on (tutor, weekday, start) so
      // reseeding does not stack duplicate rules on top of each other.
      for (const window of seed.availability) {
        const [existingRule] = await db
          .select({ id: availabilityRules.id })
          .from(availabilityRules)
          .where(
            and(
              eq(availabilityRules.tutorProfileId, tutorProfileId),
              eq(availabilityRules.dayOfWeek, window.dayOfWeek),
              eq(availabilityRules.localStartTime, window.localStartTime),
            ),
          );
        if (existingRule === undefined) {
          await db.insert(availabilityRules).values({
            tutorProfileId,
            dayOfWeek: window.dayOfWeek,
            localStartTime: window.localStartTime,
            localEndTime: window.localEndTime,
            ianaTimeZone: SEED_TIME_ZONE,
            effectiveFrom: SEED_EFFECTIVE_FROM,
            lessonFormatCode: 'any',
          });
        }
      }

      // One blocked period for the limited tutor, so the derived slots exercise
      // a removal rather than only ever adding. Its reason is server-only and
      // must never reach a family — it exists to prove that boundary is real.
      if (seed.email === 'tutor.b@local.studdy.test') {
        const blockStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        blockStart.setUTCMinutes(0, 0, 0);
        const [existingBlock] = await db
          .select({ id: availabilityExceptions.id })
          .from(availabilityExceptions)
          .where(eq(availabilityExceptions.tutorProfileId, tutorProfileId));
        if (existingBlock === undefined) {
          await db.insert(availabilityExceptions).values({
            tutorProfileId,
            startsAt: blockStart,
            endsAt: new Date(blockStart.getTime() + 4 * 60 * 60 * 1000),
            effectCode: 'removes',
            reasonCode: 'personal_commitment',
            privateNote: 'Synthetic: proves a private reason never reaches a family.',
            isPrivate: true,
          });
        }
      }

      console.log(`seeded tutor ${seed.publicFirstName} (${seed.email})`);
    }
  } finally {
    await sql.end();
  }
}
