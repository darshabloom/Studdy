import { TutorCalendarView, type CalendarSearchParams } from '@/app/tutor/calendar/calendar-view';

export const metadata = { title: 'Recurring' };

export default function Page({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  return <TutorCalendarView view="recurring" searchParams={searchParams} />;
}
