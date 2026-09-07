import type { DemoBand, Weekday } from './timeline';
import { HOUR } from './timeline';

/**
 * THE CAST. Invented people, invented lessons, invented money.
 *
 * Every name, price and relationship below was written for this demo. None of
 * it comes from the database, and no real tutor, parent or student appears here
 * or can be inferred from it.
 *
 * Static only — no dates. The story's dates are derived from today in
 * `schedule.ts`, so this file stays a plain description of who these people are
 * and what they have agreed to.
 */

/* ------------------------------------------------------------------ *
 * MONEY — one rate card, and every screen derives from it.
 * ------------------------------------------------------------------ */

/**
 * Stacey's rates, in minor units. THE ONLY PLACE A PRICE IS WRITTEN DOWN.
 *
 * Services, requests, bookings, lessons, the parent's payment screen and the
 * week's earnings line all read through `priceFor`, so a figure cannot drift
 * between two screens describing the same lesson. That is worth a lookup
 * function for what is otherwise two numbers.
 */
export const RATE_MINOR: Readonly<Record<number, bigint>> = {
  60: 5500n,
  90: 8000n,
};

export const CURRENCY = 'NZD';

export function priceFor(durationMinutes: number): bigint {
  const rate = RATE_MINOR[durationMinutes];
  // A duration with no published rate is a fixture bug, not a runtime
  // condition — better to fail loudly here than to render a lesson as free.
  if (rate === undefined) {
    throw new Error(`fixtures: no rate published for ${String(durationMinutes)} minutes`);
  }
  return rate;
}

/** '$55.00' */
export function money(amountMinor: bigint): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: CURRENCY }).format(
    Number(amountMinor) / 100,
  );
}

/* ------------------------------------------------------------------ *
 * THE TUTOR
 * ------------------------------------------------------------------ */

export interface DemoService {
  readonly id: string;
  readonly name: string;
  readonly levels: string;
  readonly durations: readonly number[];
  readonly online: boolean;
  readonly inPerson: boolean;
  readonly note: string;
}

/** What Stacey offers. The levels here are the ones her students actually sit. */
export const SERVICES: readonly DemoService[] = [
  {
    id: 'junior',
    name: 'Years 8–10 Maths',
    levels: 'Years 8–10',
    durations: [60],
    online: true,
    inPerson: true,
    note: 'Number, algebra and measurement. Building the ground the NCEA years stand on.',
  },
  {
    id: 'ncea1',
    name: 'NCEA Level 1 Maths',
    levels: 'Year 11',
    durations: [60, 90],
    online: true,
    inPerson: true,
    note: 'Internals and externals. Ninety minutes suits the fortnight before an assessment.',
  },
  {
    id: 'ncea2',
    name: 'NCEA Level 2 Maths',
    levels: 'Year 12',
    durations: [60, 90],
    online: true,
    inPerson: true,
    note: 'Algebra, graphs, trigonometry and the calculus foundations.',
  },
  {
    id: 'calculus',
    name: 'Calculus and senior exam preparation',
    levels: 'Years 12–13',
    durations: [90],
    online: true,
    inPerson: false,
    note: 'Ninety minutes only — past papers under time need the full sitting.',
  },
];

export function serviceById(id: string): DemoService | null {
  return SERVICES.find((service) => service.id === id) ?? null;
}

export const STACEY = {
  slug: 'stacey',
  firstName: 'Stacey',
  initials: 'SW',
  headline: 'NCEA Maths and Calculus, Years 8–13. Calm, methodical, six years at it.',
  teachingApproach:
    'We start every lesson by finding the one idea that is actually blocking the rest, and we fix that before touching anything else. I set two short practice problems between lessons, never a worksheet. Most of my students arrive somewhere between "I am fine until the word problems" and "I have given up on Maths", and both are workable.',
  ratingHundredths: 490,
  completedLessonCount: 340,
  yearLevelFrom: 8,
  yearLevelTo: 13,
  verificationLabels: [
    'identity_verified',
    'qualification_verified',
    'references_completed',
    'studdy_interviewed',
  ],
  /**
   * When she is WILLING to teach, every week. What she has committed to lives
   * in `schedule.ts`, and one-off changes live in `EXCEPTIONS` below.
   *
   * WEEKDAY AFTERNOONS ONLY, and that is a calendar decision as much as a
   * fixture one. A single Saturday-morning band in here would drag the shared
   * vertical axis of every calendar in the demo from 15:00–20:00 out to
   * 09:00–20:00 — eleven hours, eight of them empty, on a tutor who teaches
   * four. Her Saturday work is genuinely occasional, so it is modelled as what
   * it actually is: a one-off change.
   */
  bands: [
    { weekday: 'Mon' as Weekday, startMinutes: 15.5 * HOUR, endMinutes: 19.5 * HOUR },
    { weekday: 'Tue' as Weekday, startMinutes: 15.5 * HOUR, endMinutes: 19.5 * HOUR },
    { weekday: 'Wed' as Weekday, startMinutes: 15.5 * HOUR, endMinutes: 19.5 * HOUR },
    { weekday: 'Thu' as Weekday, startMinutes: 15.5 * HOUR, endMinutes: 19.5 * HOUR },
  ] as readonly DemoBand[],
} as const;

/**
 * A one-off change to the regular week: a date opened or closed on its own,
 * without touching the standing hours.
 *
 * `opens` widens the calendar's axis for that day only, which is exactly why
 * the demo has one — it is the case the Availability page needs to explain, and
 * the reason her Saturday is not a weekly band.
 */
export interface DemoException {
  readonly id: string;
  readonly weekday: Weekday;
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly opens: boolean;
  readonly reason: string;
}

export const EXCEPTIONS: readonly DemoException[] = [
  {
    id: 'exam-saturday',
    weekday: 'Sat',
    startMinutes: 9 * HOUR,
    endMinutes: 12 * HOUR,
    opens: true,
    reason: 'Extra hours for exam season',
  },
];

/* ------------------------------------------------------------------ *
 * THE STUDENTS — five relationships, five different shapes
 * ------------------------------------------------------------------ */

export type Cadence = 'weekly' | 'one_off' | 'trial' | 'paused';

export const CADENCE_LABEL: Readonly<Record<Cadence, string>> = {
  weekly: 'Weekly',
  one_off: 'One-off',
  trial: 'Trial',
  paused: 'Paused',
};

export interface DemoStudent {
  readonly slug: string;
  readonly firstName: string;
  readonly initials: string;
  readonly schoolYear: number;
  readonly serviceId: string;
  readonly cadence: Cadence;
  /** The standing slot. For a one-off or a trial, its single occurrence. */
  readonly weekday: Weekday;
  readonly startMinutes: number;
  readonly durationMinutes: number;
  readonly format: 'online' | 'in_person';
  readonly lessonsSoFar: number;
  /** Free text; for a paused relationship this says when it resumes. */
  readonly standing: string;
  readonly parentName: string;
  readonly parentInitials: string;
  readonly goal: string;
  /** Most recent first. Drives the Lessons page and its history. */
  readonly recentTopics: readonly string[];
}

export const STUDENTS: readonly DemoStudent[] = [
  {
    slug: 'jacob',
    firstName: 'Jacob',
    initials: 'JR',
    schoolYear: 11,
    serviceId: 'ncea1',
    cadence: 'weekly',
    // THE ANCHOR OF THE WHOLE DEMO. Jacob's standing lesson is TUESDAY AT
    // 4:00 PM and it is that on every screen, on both sides. The rebooking
    // journey books an EXTRA session at another time; it never moves this one.
    weekday: 'Tue',
    startMinutes: 16 * HOUR,
    durationMinutes: 60,
    format: 'online',
    lessonsSoFar: 14,
    standing: 'Weekly, Tuesdays at 4:00 pm since March',
    parentName: 'Priya Raman',
    parentInitials: 'PR',
    goal: 'NCEA Level 1 algebra — confident with the mechanics, freezes on worded problems.',
    recentTopics: [
      'Quadratic equations',
      'Simultaneous equations',
      'Factorising practice',
      'Linear graphs',
    ],
  },
  {
    slug: 'sophie',
    firstName: 'Sophie',
    initials: 'SC',
    schoolYear: 9,
    serviceId: 'junior',
    cadence: 'weekly',
    weekday: 'Thu',
    startMinutes: 16.5 * HOUR,
    durationMinutes: 60,
    format: 'in_person',
    lessonsSoFar: 9,
    standing: 'Weekly, Thursdays at 4:30 pm since May',
    parentName: 'Hannah Clarke',
    parentInitials: 'HC',
    goal: 'Fractions and ratios. Rebuilding confidence after a rough end to Year 8.',
    recentTopics: ['Ratio word problems', 'Equivalent fractions', 'Percentages'],
  },
  {
    slug: 'leo',
    firstName: 'Leo',
    initials: 'LB',
    schoolYear: 13,
    serviceId: 'calculus',
    cadence: 'one_off',
    weekday: 'Wed',
    startMinutes: 17.5 * HOUR,
    durationMinutes: 90,
    format: 'online',
    lessonsSoFar: 1,
    standing: 'One-off session, booked for this week',
    parentName: 'Marcus Bennett',
    parentInitials: 'MB',
    goal: 'Differentiation past papers before the external.',
    recentTopics: ['Differentiation from first principles'],
  },
  {
    slug: 'mia',
    firstName: 'Mia',
    initials: 'MO',
    schoolYear: 8,
    serviceId: 'junior',
    cadence: 'trial',
    weekday: 'Mon',
    startMinutes: 15.5 * HOUR,
    durationMinutes: 60,
    format: 'in_person',
    lessonsSoFar: 0,
    standing: 'Trial lesson — first time with Stacey',
    parentName: 'Rachel Osei',
    parentInitials: 'RO',
    goal: 'Finding out where the gaps are before committing to anything regular.',
    recentTopics: [],
  },
  {
    slug: 'ethan',
    firstName: 'Ethan',
    initials: 'EW',
    schoolYear: 10,
    serviceId: 'junior',
    cadence: 'paused',
    weekday: 'Mon',
    startMinutes: 17 * HOUR,
    durationMinutes: 60,
    format: 'online',
    lessonsSoFar: 22,
    standing: 'Paused for the school holidays — resumes Monday 12 October',
    parentName: 'Tom Whiting',
    parentInitials: 'TW',
    goal: 'Steady maintenance. Back to weekly once term starts.',
    recentTopics: ['Surds and indices', 'Solving inequalities'],
  },
];

export function studentBySlug(slug: string): DemoStudent | null {
  return STUDENTS.find((student) => student.slug === slug) ?? null;
}

/** Relationships whose lessons actually land on a calendar this week. */
export const ACTIVE_STUDENTS = STUDENTS.filter((student) => student.cadence !== 'paused');

/** The family both parent journeys follow. */
export const JACOB: DemoStudent = STUDENTS[0]!;

export const PRIYA = {
  name: 'Priya Raman',
  firstName: 'Priya',
  initials: 'PR',
} as const;

/* ------------------------------------------------------------------ *
 * DISCOVERY — the tutors Priya meets when she needs a subject Stacey
 * does not teach. Physics, so Stacey correctly never appears.
 * ------------------------------------------------------------------ */

export interface DemoTutor {
  readonly slug: string;
  readonly firstName: string;
  readonly initials: string;
  readonly headline: string;
  readonly teachingApproach: string;
  readonly hourlyMinor: bigint;
  readonly subjectDisplayName: string;
  readonly subjects: readonly string[];
  readonly yearLevelFrom: number;
  readonly yearLevelTo: number;
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly ratingHundredths: number | null;
  readonly completedLessonCount: number;
  readonly isNewToStuddy: boolean;
  readonly availabilityLabelCode: string;
  readonly verificationLabels: readonly string[];
  readonly bands: readonly DemoBand[];
}

const afternoons = (weekdays: readonly Weekday[], from: number, to: number): readonly DemoBand[] =>
  weekdays.map((weekday) => ({
    weekday,
    startMinutes: from * HOUR,
    endMinutes: to * HOUR,
  }));

export const PHYSICS_TUTORS: readonly DemoTutor[] = [
  {
    slug: 'daniel',
    firstName: 'Daniel',
    initials: 'DO',
    headline: 'NCEA Physics, Years 11–13. Exam technique is half the marks.',
    teachingApproach:
      'Content first, then past papers under time. Students usually know more than their grades suggest and lose it in the exam room.',
    hourlyMinor: 4800n,
    subjectDisplayName: 'Physics',
    subjects: ['Physics', 'Mathematics'],
    yearLevelFrom: 11,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: false,
    ratingHundredths: 470,
    completedLessonCount: 96,
    isNewToStuddy: false,
    availabilityLabelCode: 'accepting_new',
    verificationLabels: ['identity_verified', 'qualification_verified'],
    bands: afternoons(['Mon', 'Tue', 'Thu'], 16, 19.5),
  },
  {
    slug: 'mei',
    firstName: 'Mei',
    initials: 'ML',
    headline: 'Scholarship Physics and Chemistry — for students already doing well.',
    teachingApproach:
      'I work with students aiming at Excellence and Scholarship. Expect to be stretched, and to be given problems that do not have a method you have already seen.',
    hourlyMinor: 5800n,
    subjectDisplayName: 'Physics',
    subjects: ['Physics', 'Chemistry'],
    yearLevelFrom: 11,
    yearLevelTo: 13,
    offersOnline: true,
    offersInPerson: true,
    ratingHundredths: 500,
    completedLessonCount: 210,
    isNewToStuddy: false,
    availabilityLabelCode: 'limited',
    verificationLabels: [
      'identity_verified',
      'qualification_verified',
      'references_completed',
      'studdy_interviewed',
    ],
    bands: [
      ...afternoons(['Wed', 'Thu'], 17, 20),
      { weekday: 'Sat', startMinutes: 9 * HOUR, endMinutes: 12 * HOUR },
    ],
  },
  {
    slug: 'ana',
    firstName: 'Ana',
    initials: 'AF',
    headline: 'Physics and Science, Years 11–13. In person, around central Auckland.',
    teachingApproach:
      'Lots of diagrams and worked examples on paper. Seniors do better when they can see a whole derivation at once rather than a screen at a time.',
    hourlyMinor: 5200n,
    subjectDisplayName: 'Physics',
    subjects: ['Physics', 'Science'],
    yearLevelFrom: 11,
    yearLevelTo: 13,
    offersOnline: false,
    offersInPerson: true,
    ratingHundredths: 480,
    completedLessonCount: 130,
    isNewToStuddy: false,
    availabilityLabelCode: 'available_this_week',
    verificationLabels: ['identity_verified', 'qualification_verified', 'references_completed'],
    bands: afternoons(['Tue', 'Wed', 'Fri'], 15.5, 19),
  },
  {
    slug: 'tane',
    firstName: 'Tāne',
    initials: 'TR',
    headline: 'Years 9–11 Science and Physics. Patient with students who have lost confidence.',
    teachingApproach:
      'Third-year Engineering student, and I was a Year 11 who hated Physics. Slow, no jargon, and we celebrate the small wins.',
    hourlyMinor: 4000n,
    subjectDisplayName: 'Physics',
    subjects: ['Physics', 'Science'],
    yearLevelFrom: 9,
    yearLevelTo: 11,
    offersOnline: true,
    offersInPerson: false,
    ratingHundredths: null,
    completedLessonCount: 4,
    isNewToStuddy: true,
    availabilityLabelCode: 'accepting_new',
    verificationLabels: ['identity_verified'],
    bands: afternoons(['Wed', 'Thu', 'Sun'], 15, 18),
  },
];

export function physicsTutor(slug: string): DemoTutor | null {
  return PHYSICS_TUTORS.find((tutor) => tutor.slug === slug) ?? null;
}

/** The tutor the discovery story ends on. */
export const DISCOVERY_TUTOR_SLUG = 'daniel';

/* ------------------------------------------------------------------ *
 * REFERENCES — shaped like the real ones, and not real ones
 * ------------------------------------------------------------------ */

export const REFERENCES = {
  rebook: 'ILR-4K7M2X',
  rebookTutor: 'TREQ-9QH3N6',
  discovery: 'ILR-8P2W5D',
  discoveryTutor: 'TREQ-3XM7K1',
  leo: 'TREQ-6BN4T8',
  chloe: 'TREQ-2VD9L5',
  mia: 'TREQ-5RK8W2',
} as const;

/** How long a chosen tutor's time is held while the family pays. */
export const PAYMENT_WINDOW_MINUTES = 60;

/** Studdy's cut, taken OUT OF the listed price rather than added to it. */
export const COMMISSION_RATE = 0.15;
