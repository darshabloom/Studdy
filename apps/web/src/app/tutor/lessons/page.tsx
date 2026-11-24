import { PageHeader, Panel, Quiet, ViewTabs } from '@/components/parent/kit';
import { LessonRow, TutorUnavailable } from '@/components/tutor/kit';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { splitLessons } from '@/lib/tutor/overview';

export const metadata = { title: 'Lessons' };

/**
 * The tutor's lessons, as far as Studdy knows them: the bookings.
 *
 * THERE IS NO LESSON RECORD YET. A booking says what was agreed; what happened
 * in the lesson — attendance, notes, homework, a summary for the family — is a
 * separate record that has not been built (`lessons` is an empty schema). So
 * "Past" lists lessons whose time has gone, and does not call them completed.
 */
export default async function TutorLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  const view = rawView === 'past' ? 'past' : 'upcoming';
  const now = new Date();
  const { upcoming, past } = splitLessons(workspace.bookings, now);
  const shown = view === 'past' ? past : upcoming;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Lessons" />
      <ViewTabs
        label="Lesson views"
        current={view}
        tabs={[
          { key: 'upcoming', label: 'Upcoming', href: '/tutor/lessons', count: upcoming.length },
          { key: 'past', label: 'Past', href: '/tutor/lessons?view=past' },
        ]}
      />

      {shown.length === 0 ? (
        <Quiet>{view === 'past' ? 'No past lessons.' : 'No upcoming lessons.'}</Quiet>
      ) : (
        <Panel>
          <ul className="divide-y divide-surface-border">
            {shown.map((booking) => (
              <LessonRow key={booking.reference} booking={booking} now={now} />
            ))}
          </ul>
        </Panel>
      )}

      {view === 'past' ? (
        <p className="text-sm text-text-secondary">
          Lesson notes, attendance and summaries cannot be recorded on Studdy yet, so a past lesson
          shows only what was booked.
        </p>
      ) : null}
    </div>
  );
}
