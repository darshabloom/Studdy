import { TutorCalendarView, type CalendarSearchParams } from '@/app/tutor/calendar/calendar-view';

export const metadata = { title: 'Calendar' };

export default function Page({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  return <TutorCalendarView view="month" searchParams={searchParams} />;
}
