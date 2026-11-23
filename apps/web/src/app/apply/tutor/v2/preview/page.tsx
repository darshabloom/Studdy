import { emptyApplicationV2 } from '@studdy/domain/tutors';
import type { SubjectOption } from '@studdy/database';
import { TutorApplicationV2Wizard } from '@/components/tutors/application-v2-wizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tutor Application — Design Preview' };

// Synthetic catalogue for design review. No applicant data is read or written.
const DEMO_SUBJECTS: readonly SubjectOption[] = [
  { subjectId: 'sample-mathematics', code: 'MATHEMATICS', displayName: 'Mathematics' },
  { subjectId: 'sample-english', code: 'ENGLISH', displayName: 'English' },
  { subjectId: 'sample-physics', code: 'PHYSICS', displayName: 'Physics' },
  { subjectId: 'sample-chemistry', code: 'CHEMISTRY', displayName: 'Chemistry' },
  { subjectId: 'sample-biology', code: 'BIOLOGY', displayName: 'Biology' },
];

export default function TutorApplicationV2PreviewPage() {
  return <TutorApplicationV2Wizard initial={emptyApplicationV2()} subjects={DEMO_SUBJECTS} demo />;
}
