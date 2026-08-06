import { redirect } from 'next/navigation';
import { SupportDashboard } from '@/components/dashboard/support-dashboard';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export default async function ParentDashboardPage() {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Fparent');

  return (
    <SupportDashboard
      context={context}
      addStudentHref="/parent/students/new"
      addSubjectHref="/parent/subjects/new"
    />
  );
}
