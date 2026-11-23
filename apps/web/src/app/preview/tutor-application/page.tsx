import Image from 'next/image';
import Link from 'next/link';
import type { SubjectOption } from '@studdy/database';
import { emptyApplicationV2 } from '@studdy/domain/tutors';
import logo from '@/assets/brand/studdy-logo-approved.webp';
import { TopNavFrame } from '@/components/layout/top-nav-frame';
import { TutorApplicationV2Wizard } from '@/components/tutors/application-v2-wizard';

export const metadata = { title: 'Tutor Application — Interactive Preview' };

// PUBLIC, READ-ONLY DESIGN PREVIEW. No identity, database access or server action.
// The wizard runs in demo mode with an in-memory synthetic draft and cannot submit.
const PREVIEW_SUBJECTS: readonly SubjectOption[] = [
  { subjectId: 'preview-mathematics', code: 'MATHEMATICS', displayName: 'Mathematics' },
  { subjectId: 'preview-english', code: 'ENGLISH', displayName: 'English' },
  { subjectId: 'preview-physics', code: 'PHYSICS', displayName: 'Physics' },
  { subjectId: 'preview-chemistry', code: 'CHEMISTRY', displayName: 'Chemistry' },
  { subjectId: 'preview-biology', code: 'BIOLOGY', displayName: 'Biology' },
];

export default function TutorApplicationDesignPreview() {
  return (
    <TopNavFrame
      mainClassName="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-8"
      bar={
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-3">
          <Link href="/" className="flex shrink-0 items-center py-1">
            <Image src={logo} alt="Studdy" unoptimized priority className="h-[40px] w-auto" />
          </Link>
          <span className="text-sm font-semibold text-parent-navy">
            Tutor Application · Design preview
          </span>
        </div>
      }
    >
      <TutorApplicationV2Wizard initial={emptyApplicationV2()} subjects={PREVIEW_SUBJECTS} demo />
    </TopNavFrame>
  );
}
