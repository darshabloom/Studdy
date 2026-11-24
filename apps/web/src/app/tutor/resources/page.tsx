import { PageHeader, Quiet } from '@/components/parent/kit';

export const metadata = { title: 'Resources' };

export default function TutorResourcesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Resources" />
      <Quiet>
        Resources are not available yet. Worksheets, links and files you want to keep for your
        students will live here, and you will be able to share them with a student from a lesson.
      </Quiet>
    </div>
  );
}
