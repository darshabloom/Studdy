'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Label } from '@studdy/design-system';
import { SCHOOL_YEAR_CODES, schoolYearLabel } from '@studdy/domain/students';
import { addSubjectNeedAction, type FormState } from '@/lib/discovery/actions';

const initialState: FormState = { error: null, message: null };

export interface SubjectOption {
  subjectId: string;
  code: string;
  displayName: string;
}

export interface StudentOption {
  studentProfileId: string;
  preferredName: string;
  schoolYearCode: string | null;
}

const FORMATS = [
  { code: 'either', label: 'Either is fine' },
  { code: 'online', label: 'Online' },
  { code: 'in_person', label: 'In person' },
] as const;

const selectClass =
  'h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted';

/** Shared subject-need form. The student selector appears only when acting for others. */
export function SubjectNeedForm({
  subjects,
  students,
  actsForOthers,
}: {
  subjects: readonly SubjectOption[];
  students: readonly StudentOption[];
  actsForOthers: boolean;
}) {
  const [state, formAction, pending] = useActionState(addSubjectNeedAction, initialState);
  const firstStudent = students[0];
  const [studentProfileId, setStudentProfileId] = useState(firstStudent?.studentProfileId ?? '');
  const [subjectId, setSubjectId] = useState('');
  const [schoolYearCode, setSchoolYearCode] = useState(firstStudent?.schoolYearCode ?? '');
  const [formatPreferenceCode, setFormatPreferenceCode] = useState('either');
  const [goals, setGoals] = useState('');

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="studentProfileId" value={studentProfileId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="schoolYearCode" value={schoolYearCode} />
      <input type="hidden" name="formatPreferenceCode" value={formatPreferenceCode} />
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}

      {actsForOthers && students.length > 1 ? (
        <div>
          <Label htmlFor="student">Which student?</Label>
          <select
            id="student"
            value={studentProfileId}
            onChange={(event) => setStudentProfileId(event.target.value)}
            className={selectClass}
          >
            {students.map((student) => (
              <option key={student.studentProfileId} value={student.studentProfileId}>
                {student.preferredName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <Label htmlFor="subject">Subject</Label>
        <select
          id="subject"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className={selectClass}
        >
          <option value="">Choose a subject</option>
          {subjects.map((subject) => (
            <option key={subject.subjectId} value={subject.subjectId}>
              {subject.displayName}
            </option>
          ))}
        </select>
        {state.issues?.['subjectId'] !== undefined ? (
          <p role="alert" className="mt-1 text-sm text-status-critical">
            {state.issues['subjectId']}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="subject-year">School year for this subject</Label>
        <select
          id="subject-year"
          value={schoolYearCode}
          onChange={(event) => setSchoolYearCode(event.target.value)}
          className={selectClass}
        >
          <option value="">Choose a year level</option>
          {SCHOOL_YEAR_CODES.map((code) => (
            <option key={code} value={code}>
              {schoolYearLabel(code)}
            </option>
          ))}
        </select>
        {state.issues?.['schoolYearCode'] !== undefined ? (
          <p role="alert" className="mt-1 text-sm text-status-critical">
            {state.issues['schoolYearCode']}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="format">How should lessons happen?</Label>
        <select
          id="format"
          value={formatPreferenceCode}
          onChange={(event) => setFormatPreferenceCode(event.target.value)}
          className={selectClass}
        >
          {FORMATS.map((format) => (
            <option key={format.code} value={format.code}>
              {format.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="goals">What would you like to work on? (optional)</Label>
        <textarea
          id="goals"
          name="goals"
          rows={3}
          value={goals}
          onChange={(event) => setGoals(event.target.value)}
          className="w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card p-3 text-base text-text-primary hover:border-text-muted"
          placeholder=""
        />
        <p className="mt-1 text-sm text-text-secondary">
          Helps tutors understand the goal before you contact them.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save and find tutors'}
      </Button>
    </form>
  );
}
