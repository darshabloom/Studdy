import type { DemoBand, Weekday } from './timeline';
import { HOUR } from './timeline';

/**
 * THE CAST. Invented people, invented lessons.
 *
 * Every name, price, rating and sentence below was written for this demo. None
 * of it comes from the database, and no real tutor, parent or student appears
 * here or can be inferred from it. The demo chrome says so on every screen.
 *
 * Static data only — no dates. The story's dates are derived from today in
 * `story.ts`, so this file stays a plain description of who the people are.
 */

export interface DemoTutor {
  readonly slug: string;
  readonly firstName: string;
  readonly initials: string;
  readonly headline: string;
  readonly teachingApproach: string;
  /** Minor units, NZD. */
  readonly startingPriceAmountMinor: bigint;
  readonly startingPriceDurationMinutes: number;
  readonly subjectDisplayName: string;
  readonly subjects: readonly string[];
  readonly yearLevelFrom: number;
  readonly yearLevelTo: number;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  /** Hundredths, as the production projection stores it (490 = 4.9). */
  readonly ratingHundredths: number | null;
  readonly completedLessonCount: number;
  readonly isNewToStuddy: boolean;
  readonly availabilityLabelCode: string;
  readonly verificationLabels: readonly string[];
  /** The teaching week behind this tutor's calendars. */
  readonly bands: readonly DemoBand[];
}

const afternoons = (weekdays: readonly Weekday[], from: number, to: number): readonly DemoBand[] =>
  weekdays.map((weekday) => ({
    weekday,
    startMinutes: from * HOUR,
    endMinutes: to * HOUR,
  }));

export const DEMO_TUTORS: readonly DemoTutor[] = [
  {
    slug: 'aroha',
    firstName: 'Aroha',
    initials: 'AW',
    headline: 'NCEA Maths specialist — Level 1 to Level 3, calm and methodical',
    teachingApproach:
      'We start every lesson by finding the one idea that is actually blocking the rest, and we fix that before touching anything else. I set two short practice problems between lessons, never a worksheet. Most of my students come to me somewhere between "I am fine until the word problems" and "I have given up on Maths", and both are workable.',
    startingPriceAmountMinor: 4500n,
    startingPriceDurationMinutes: 60,
    subjectDisplayName: 'Mathematics',
    subjects: ['Mathematics', 'Statistics'],
    yearLevelFrom: 9,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: true,
    ratingHundredths: 490,
    completedLessonCount: 128,
    isNewToStuddy: false,
    availabilityLabelCode: 'available_this_week',
    verificationLabels: ['identity_verified', 'qualification_verified', 'studdy_interviewed'],
    // Weekday after-school only. A Saturday morning band would be just as
    // believable, but it stretches every calendar she appears on to span 9am
    // to 7pm — and the four hours of dead middle cost more legibility than a
    // weekend option buys. Mei carries the weekend instead, so discovery still
    // shows a tutor who teaches then.
    bands: afternoons(['Mon', 'Tue', 'Wed', 'Thu'], 15.5, 19),
  },
  {
    slug: 'daniel',
    firstName: 'Daniel',
    initials: 'DO',
    headline: 'Maths and Physics, Year 11–13. Exam technique is half the marks',
    teachingApproach:
      'Content first, then past papers under time. Students usually know more than their grades suggest and lose it in the exam room.',
    startingPriceAmountMinor: 4000n,
    startingPriceDurationMinutes: 60,
    subjectDisplayName: 'Mathematics',
    subjects: ['Mathematics', 'Physics'],
    yearLevelFrom: 11,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: false,
    ratingHundredths: 470,
    completedLessonCount: 76,
    isNewToStuddy: false,
    availabilityLabelCode: 'accepting_new',
    verificationLabels: ['identity_verified', 'qualification_verified'],
    bands: [...afternoons(['Tue', 'Wed', 'Fri'], 16, 20)],
  },
  {
    slug: 'mei',
    firstName: 'Mei',
    initials: 'ML',
    headline: 'Scholarship Maths and Chemistry — for students already doing well',
    teachingApproach:
      'I work with students aiming at Excellence and Scholarship. Expect to be stretched and to be given problems that do not have a method you have already seen.',
    startingPriceAmountMinor: 5200n,
    startingPriceDurationMinutes: 60,
    subjectDisplayName: 'Mathematics',
    subjects: ['Mathematics', 'Chemistry'],
    yearLevelFrom: 11,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: true,
    ratingHundredths: 500,
    completedLessonCount: 214,
    isNewToStuddy: false,
    availabilityLabelCode: 'limited',
    verificationLabels: [
      'identity_verified',
      'qualification_verified',
      'references_completed',
      'studdy_interviewed',
    ],
    bands: [
      ...afternoons(['Mon', 'Thu'], 17, 20),
      { weekday: 'Sat', startMinutes: 9 * HOUR, endMinutes: 12 * HOUR },
    ],
  },
  {
    slug: 'tane',
    firstName: 'Tāne',
    initials: 'TR',
    headline: 'Year 9–11 Maths. Patient with students who have lost confidence',
    teachingApproach:
      'Third-year Engineering student, and I was a Year 11 who hated Maths. Slow, no jargon, and we celebrate the small wins.',
    startingPriceAmountMinor: 3800n,
    startingPriceDurationMinutes: 60,
    subjectDisplayName: 'Mathematics',
    subjects: ['Mathematics'],
    yearLevelFrom: 9,
    yearLevelTo: 11,
    offersOnline: true,
    offersInPerson: false,
    ratingHundredths: null,
    completedLessonCount: 3,
    isNewToStuddy: true,
    availabilityLabelCode: 'accepting_new',
    verificationLabels: ['identity_verified'],
    bands: [...afternoons(['Wed', 'Thu', 'Sun'], 15, 18)],
  },
];

export function demoTutor(slug: string): DemoTutor | null {
  return DEMO_TUTORS.find((tutor) => tutor.slug === slug) ?? null;
}

/** The tutor the scripted story runs through, on both sides. */
export const STORY_TUTOR_SLUG = 'aroha';

export const DEMO_FAMILY = {
  parentName: 'Priya Raman',
  parentInitials: 'PR',
  studentPreferredName: 'Nikau',
  studentFullName: 'Nikau Raman',
  schoolYearCode: 'Year 11',
  schoolYearNumber: 11,
  subjectDisplayName: 'Mathematics',
  subjectDetail: 'NCEA Level 1',
  notesForTutors:
    'Nikau is doing NCEA Level 1 Maths and has an algebra assessment in three weeks. He is fine with the mechanics but freezes on anything worded. Happy to start with one lesson and see how it goes.',
} as const;

/** References are shaped like the real ones, and are not real ones. */
export const DEMO_REFERENCES = {
  request: 'ILR-4K7M2X',
  tutorRequest: 'TREQ-9QH3N6',
} as const;

export const DEMO_CURRENCY = 'NZD';
export const DEMO_DURATION_MINUTES = 60;
export const DEMO_FORMAT: 'online' | 'in_person' = 'online';
/** How long a chosen tutor's time is held while the family pays. */
export const DEMO_PAYMENT_WINDOW_MINUTES = 60;
