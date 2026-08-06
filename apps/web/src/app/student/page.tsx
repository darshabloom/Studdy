import { redirect } from 'next/navigation';
import { SupportDashboard } from '@/components/dashboard/support-dashboard';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export default async function StudentDashboardPage() {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Fstudent');

  return (
    <SupportDashboard
      context={context}
      addStudentHref="/student/setup"
      addSubjectHref="/student/subjects/new"
    />
  );
}
