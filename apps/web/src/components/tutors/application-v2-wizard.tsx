'use client';

import { useEffect, useRef, useState } from 'react';
import type { TutorApplicationV2Draft } from '@studdy/domain/tutors';
import { TUTOR_YEAR_LEVELS } from '@studdy/domain/tutors';
import type { SubjectOption, V2DraftSave } from '@studdy/database';

type Group = 'about' | 'subjects' | 'teaching' | 'qualifications' | 'declarations';
type SaveAction = (draft: TutorApplicationV2Draft, version: number) => Promise<V2DraftSave>;

const STEP_NAMES = [
  'About you',
  'Subjects and levels',
  'Teaching experience',
  'Qualifications',
  'Referees and checks',
  'Declarations',
] as const;
const EXPERIENCE = [
  ['none', 'None yet'],
  ['under_1_year', 'Less than 1 year'],
  ['1_2_years', '1–2 years'],
  ['3_5_years', '3–5 years'],
  ['6_10_years', '6–10 years'],
  ['over_10_years', 'More than 10 years'],
] as const;
const CURRICULA = [
  ['nz_curriculum', 'NZ Curriculum'],
  ['ncea', 'NCEA'],
  ['cambridge', 'Cambridge International'],
  ['ib', 'International Baccalaureate'],
  ['australian', 'Australian Curriculum'],
  ['university_specific', 'University-specific'],
  ['other', 'Other'],
  ['none_yet', 'None yet'],
] as const;
const SETTINGS = [
  ['private_tutoring', 'Private tutoring'],
  ['school_classroom', 'School classroom'],
  ['tertiary', 'University / tertiary'],
  ['group_tutoring', 'Group tutoring'],
  ['online_tutoring', 'Online tutoring'],
  ['informal', 'Friends or family'],
  ['none_yet', 'None yet'],
  ['other', 'Other'],
] as const;
const STUDENTS = [
  ['primary', 'Primary school'],
  ['intermediate', 'Intermediate'],
  ['secondary', 'Secondary school'],
  ['tertiary', 'University / tertiary'],
  ['adults', 'Adult learners'],
  ['no_previous_students', 'No previous students'],
] as const;
const NEEDS = [
  ['adhd', 'ADHD'],
  ['dyslexia', 'Dyslexia'],
  ['autism', 'Autism'],
  ['learning_difficulties', 'Learning difficulties'],
  ['eal', 'English as an additional language'],
  ['gifted', 'Gifted learners'],
  ['exam_anxiety', 'Exam anxiety'],
  ['other', 'Other'],
  ['none', 'No specific experience'],
] as const;
const EDUCATION = [
  ['secondary', 'Secondary school / currently attending'],
  ['ncea_1', 'NCEA Level 1'],
  ['ncea_2', 'NCEA Level 2'],
  ['ncea_3', 'NCEA Level 3'],
  ['certificate', 'Certificate'],
  ['diploma', 'Diploma'],
  ['bachelors', "Bachelor's degree"],
  ['postgraduate', 'Postgraduate qualification'],
  ['other', 'Other'],
] as const;
const REFEREE_TYPES = [
  ['teacher', 'Teacher / lecturer'],
  ['school_leader', 'School leader'],
  ['employer', 'Employer / supervisor'],
  ['client', 'Previous tutoring client'],
  ['coach', 'Coach / mentor'],
  ['community', 'Community leader'],
  ['other', 'Other — reviewed individually'],
] as const;
const FIELD =
  'w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-purple';

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-parent-navy">
      {label}
      <input
        className={FIELD}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="text-xs font-normal text-text-secondary">{hint}</span> : null}
    </label>
  );
}
function LongField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-parent-navy">
      {label}
      <textarea
        className={FIELD}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="text-xs font-normal text-text-secondary">{hint}</span> : null}
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-parent-navy">
      {label}
      <select className={FIELD} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Please select</option>
        {options.map(([key, text]) => (
          <option value={key} key={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
function Tick({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-text-primary">
      <input
        className="mt-1 size-4 accent-brand-purple"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function Multi({
  label,
  value,
  options,
  onChange,
  exclusive,
}: {
  label: string;
  value: readonly string[];
  options: readonly (readonly [string, string])[];
  onChange: (value: string[]) => void;
  exclusive?: string;
}) {
  const toggle = (key: string, on: boolean) => {
    const next = on
      ? [...value.filter((item) => item !== key), key]
      : value.filter((item) => item !== key);
    onChange(
      on && key === exclusive
        ? [key]
        : on && exclusive
          ? next.filter((item) => item !== exclusive)
          : next,
    );
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-parent-navy">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(([key, text]) => (
          <Tick
            key={key}
            label={text}
            checked={value.includes(key)}
            onChange={(on) => toggle(key, on)}
          />
        ))}
      </div>
    </fieldset>
  );
}
function newRef(): TutorApplicationV2Draft['references'][number] {
  return {
    fullName: '',
    relationship: '',
    organisation: '',
    position: '',
    email: '',
    phone: '',
    category: '',
    permissionConfirmed: false,
    contactPreference: '',
  };
}
function newQualification(): TutorApplicationV2Draft['qualifications']['relevantQualifications'][number] {
  return { title: '', institution: '', field: '', awardedYear: '' };
}

export function TutorApplicationV2Wizard({
  initial,
  subjects,
  initialVersion,
  saveAction,
  demo = false,
}: {
  initial: TutorApplicationV2Draft;
  subjects: readonly SubjectOption[];
  initialVersion?: number;
  saveAction?: SaveAction;
  demo?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [serial, setSerial] = useState(0);
  const [version, setVersion] = useState(initialVersion ?? 0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>(
    'idle',
  );
  const savedSerial = useRef(0);
  const inFlight = useRef(false);

  const change = (next: TutorApplicationV2Draft) => {
    setDraft(next);
    setSerial((value) => value + 1);
    setSaveState('idle');
  };
  const patch = <K extends Group>(group: K, update: Partial<TutorApplicationV2Draft[K]>) => {
    change({ ...draft, [group]: { ...draft[group], ...update } });
  };
  const setReference = (
    index: number,
    update: Partial<TutorApplicationV2Draft['references'][number]>,
  ) => {
    change({
      ...draft,
      references: draft.references.map((ref, i) => (i === index ? { ...ref, ...update } : ref)),
    });
  };
  const setQualification = (
    index: number,
    update: Partial<TutorApplicationV2Draft['qualifications']['relevantQualifications'][number]>,
  ) => {
    patch('qualifications', {
      relevantQualifications: draft.qualifications.relevantQualifications.map((item, i) =>
        i === index ? { ...item, ...update } : item,
      ),
    });
  };
  const setSubject = (subjectId: string, selected: boolean) => {
    change({
      ...draft,
      subjects: {
        ...draft.subjects,
        selections: selected
          ? [...draft.subjects.selections, { subjectId, levels: [], specialisations: '' }]
          : draft.subjects.selections.filter((item) => item.subjectId !== subjectId),
      },
    });
  };

  useEffect(() => {
    if (!saveAction || serial === 0 || serial <= savedSerial.current || inFlight.current) return;
    const pending = window.setTimeout(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaveState('saving');
      const savingSerial = serial;
      void saveAction(draft, version)
        .then((result) => {
          if (result.status === 'saved') {
            savedSerial.current = savingSerial;
            setVersion(result.recordVersion);
            if (serial === savingSerial) setSaveState('saved');
          } else {
            setSaveState(result.status === 'conflict' ? 'conflict' : 'error');
          }
        })
        .catch(() => setSaveState('error'))
        .finally(() => {
          inFlight.current = false;
        });
    }, 900);
    return () => window.clearTimeout(pending);
  }, [draft, serial, version, saveAction]);

  const a = draft.about;
  const s = draft.subjects;
  const t = draft.teaching;
  const q = draft.qualifications;
  const d = draft.declarations;
  const isReview = step === STEP_NAMES.length;
  const next = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep((value) => Math.min(value + 1, STEP_NAMES.length));
  };
  const back = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep((value) => Math.max(value - 1, 0));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-text-primary">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-brand-purple">
          {demo ? 'Interactive design preview · Synthetic data only' : 'Your Tutor Application'}
        </p>
        <h1 className="font-display text-3xl font-semibold text-parent-navy">
          {isReview ? 'Review your answers' : STEP_NAMES[step]}
        </h1>
        <p className="text-sm text-text-secondary">
          {isReview
            ? 'Check your answers before final submission becomes available.'
            : 'Step ' + String(step + 1) + ' of 6'}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-card-secondary"
          role="progressbar"
          aria-label="Application sections reviewed"
          aria-valuenow={Math.min(step + 1, 6)}
          aria-valuemin={0}
          aria-valuemax={6}
        >
          <div
            className="h-full rounded-full bg-brand-purple"
            style={{ width: String(Math.min(((step + 1) / 6) * 100, 100)) + '%' }}
          />
        </div>
        {demo ? (
          <p className="rounded-lg bg-brand-lavender px-3 py-2 text-sm">
            You are reviewing the design as an approved tutor. Nothing you enter on this page is
            saved or submitted.
          </p>
        ) : (
          <p role="status" className="text-xs text-text-secondary">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Draft saved'
                : saveState === 'conflict'
                  ? 'A newer draft exists in another tab. Refresh before editing.'
                  : saveState === 'error'
                    ? 'Could not save. Keep this tab open and check your connection.'
                    : 'Your changes save automatically.'}
          </p>
        )}
      </header>

      <section className="space-y-5 rounded-xl border border-surface-border bg-white p-5 sm:p-7">
        {step === 0 ? (
          <>
            <p className="text-sm text-text-secondary">
              One Studdy account can have tutor, parent and student roles. You can switch workspaces
              later.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Legal first name *"
                value={a.legalFirstName}
                onChange={(v) => patch('about', { legalFirstName: v })}
              />
              <TextField
                label="Legal family name *"
                value={a.legalFamilyName}
                onChange={(v) => patch('about', { legalFamilyName: v })}
              />
              <TextField
                label="First name families will see *"
                value={a.preferredFirstName}
                onChange={(v) => patch('about', { preferredFirstName: v })}
              />
              <TextField
                label="Date of birth *"
                type="date"
                value={a.dateOfBirth}
                onChange={(v) => patch('about', { dateOfBirth: v })}
              />
              <TextField
                label="Mobile number *"
                type="tel"
                value={a.mobile}
                onChange={(v) => patch('about', { mobile: v })}
              />
              <TextField
                label="Where are you based? *"
                value={a.location}
                onChange={(v) => patch('about', { location: v })}
                hint="Town or suburb is enough. Your home address is private."
              />
            </div>
            <Multi
              label="Are you currently studying, working or both? (optional)"
              value={a.currentActivities}
              options={[
                ['secondary', 'Secondary school student'],
                ['tertiary', 'University / tertiary student'],
                ['school_teacher', 'School teacher'],
                ['professional_tutor', 'Professional tutor'],
                ['other', 'Other'],
              ]}
              onChange={(v) => patch('about', { currentActivities: v })}
            />
            {a.dateOfBirth && Number(a.dateOfBirth.slice(0, 4)) > new Date().getFullYear() - 18 ? (
              <p className="rounded-lg bg-parent-gold-pale p-3 text-sm">
                Applicants under 18 require additional safeguarding checks and any required guardian
                consent before approval.
              </p>
            ) : null}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-parent-navy">
                Which subjects would you like to tutor? *
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {subjects.map((subject) => (
                  <Tick
                    key={subject.subjectId}
                    label={subject.displayName}
                    checked={s.selections.some((entry) => entry.subjectId === subject.subjectId)}
                    onChange={(on) => setSubject(subject.subjectId, on)}
                  />
                ))}
              </div>
            </fieldset>
            {s.selections.map((entry) => (
              <div
                className="space-y-3 rounded-xl border border-surface-border p-4"
                key={entry.subjectId}
              >
                <h2 className="font-semibold text-parent-navy">
                  {subjects.find((subject) => subject.subjectId === entry.subjectId)?.displayName ??
                    'Subject'}
                </h2>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Education levels you can teach * ({entry.levels.length} selected)
                  </summary>
                  <div className="mt-3 grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                    {TUTOR_YEAR_LEVELS.map((level) => (
                      <Tick
                        key={level.value}
                        label={level.label}
                        checked={entry.levels.includes(Number(level.value))}
                        onChange={(on) =>
                          change({
                            ...draft,
                            subjects: {
                              ...s,
                              selections: s.selections.map((item) =>
                                item.subjectId === entry.subjectId
                                  ? {
                                      ...item,
                                      levels: on
                                        ? [...item.levels, Number(level.value)].sort(
                                            (x, y) => x - y,
                                          )
                                        : item.levels.filter((n) => n !== Number(level.value)),
                                    }
                                  : item,
                              ),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
                <TextField
                  label="Specialisations or topics (optional)"
                  value={entry.specialisations}
                  onChange={(v) =>
                    change({
                      ...draft,
                      subjects: {
                        ...s,
                        selections: s.selections.map((item) =>
                          item.subjectId === entry.subjectId
                            ? { ...item, specialisations: v }
                            : item,
                        ),
                      },
                    })
                  }
                />
              </div>
            ))}
            <TextField
              label="Suggest a subject missing from the catalogue (optional)"
              value={s.suggestedSubjects.join(', ')}
              onChange={(v) =>
                patch('subjects', {
                  suggestedSubjects: v
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              hint="Suggested subjects require Studdy review before they can be offered."
            />
            <Multi
              label="Lesson formats *"
              value={[
                ...(s.offersOnline ? ['online'] : []),
                ...(s.offersInPerson ? ['in_person'] : []),
              ]}
              options={[
                ['online', 'Online'],
                ['in_person', 'In person'],
              ]}
              onChange={(v) =>
                patch('subjects', {
                  offersOnline: v.includes('online'),
                  offersInPerson: v.includes('in_person'),
                })
              }
            />
            <Multi
              label="Which curriculum frameworks are you familiar with? *"
              value={s.curricula}
              options={CURRICULA}
              exclusive="none_yet"
              onChange={(v) => patch('subjects', { curricula: v })}
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <SelectField
              label="How much teaching or tutoring experience do you have? *"
              value={t.experience}
              options={EXPERIENCE}
              onChange={(v) => patch('teaching', { experience: v })}
            />
            <Multi
              label="In what settings have you taught or tutored? *"
              value={t.settings}
              options={SETTINGS}
              exclusive="none_yet"
              onChange={(v) => patch('teaching', { settings: v })}
            />
            <LongField
              label="How would you describe your teaching approach? *"
              value={t.approach}
              onChange={(v) => patch('teaching', { approach: v })}
              hint="At least 40 characters. How would you explain a difficult concept or help a student who is stuck?"
            />
            <Multi
              label="Which types of students have you worked with? *"
              value={t.studentGroups}
              options={STUDENTS}
              exclusive="no_previous_students"
              onChange={(v) => patch('teaching', { studentGroups: v })}
            />
            <Multi
              label="Experience supporting particular learning needs (optional)"
              value={t.learningNeeds}
              options={NEEDS}
              exclusive="none"
              onChange={(v) => patch('teaching', { learningNeeds: v })}
            />
            <LongField
              label="Tell us about a time you helped someone learn something (optional)"
              value={t.example}
              onChange={(v) => patch('teaching', { example: v })}
              hint="Avoid including any student's identifying information."
            />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <SelectField
              label="Highest completed education level *"
              value={q.highestEducation}
              options={EDUCATION}
              onChange={(v) => patch('qualifications', { highestEducation: v })}
            />
            <SelectField
              label="Are you currently studying towards a qualification? *"
              value={q.currentlyStudying}
              options={[
                ['yes', 'Yes'],
                ['no', 'No'],
              ]}
              onChange={(v) => patch('qualifications', { currentlyStudying: v as 'yes' | 'no' })}
            />
            {q.currentlyStudying === 'yes' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Qualification *"
                  value={q.currentQualification}
                  onChange={(v) => patch('qualifications', { currentQualification: v })}
                />
                <TextField
                  label="Institution *"
                  value={q.currentInstitution}
                  onChange={(v) => patch('qualifications', { currentInstitution: v })}
                />
                <TextField
                  label="Expected completion year *"
                  value={q.expectedCompletionYear}
                  onChange={(v) => patch('qualifications', { expectedCompletionYear: v })}
                />
              </div>
            ) : null}
            <Tick
              label="I have no relevant qualifications yet"
              checked={q.noRelevantQualifications}
              onChange={(on) =>
                patch('qualifications', {
                  noRelevantQualifications: on,
                  relevantQualifications: on ? [] : q.relevantQualifications,
                })
              }
            />
            {!q.noRelevantQualifications ? (
              <>
                {q.relevantQualifications.map((item, i) => (
                  <div
                    className="grid gap-3 rounded-lg border border-surface-border p-3 sm:grid-cols-2"
                    key={i}
                  >
                    <TextField
                      label="Qualification / certificate"
                      value={item.title}
                      onChange={(v) => setQualification(i, { title: v })}
                    />
                    <TextField
                      label="Issuing institution"
                      value={item.institution}
                      onChange={(v) => setQualification(i, { institution: v })}
                    />
                    <TextField
                      label="Subject / field"
                      value={item.field}
                      onChange={(v) => setQualification(i, { field: v })}
                    />
                    <TextField
                      label="Year awarded"
                      value={item.awardedYear}
                      onChange={(v) => setQualification(i, { awardedYear: v })}
                    />
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-brand-purple"
                      onClick={() =>
                        patch('qualifications', {
                          relevantQualifications: q.relevantQualifications.filter(
                            (_, j) => i !== j,
                          ),
                        })
                      }
                    >
                      Remove qualification
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-purple"
                  onClick={() =>
                    patch('qualifications', {
                      relevantQualifications: [...q.relevantQualifications, newQualification()],
                    })
                  }
                >
                  + Add qualification
                </button>
              </>
            ) : null}
            <SelectField
              label="When can you provide evidence of your qualifications? *"
              value={q.evidenceIntention}
              options={[
                [
                  'will_provide_later',
                  "I'll provide supporting documents later through my profile",
                ],
                ['available_for_verification', 'I have documents available for verification'],
                ['none_to_provide', 'I have no qualification evidence to provide'],
              ]}
              onChange={(v) =>
                patch('qualifications', { evidenceIntention: v as typeof q.evidenceIntention })
              }
            />
            <LongField
              label="Academic results relevant to your subjects (optional)"
              value={q.academicResults}
              onChange={(v) => patch('qualifications', { academicResults: v })}
            />
            <LongField
              label="Teaching / professional credentials (optional)"
              value={q.professionalCredentials}
              onChange={(v) => patch('qualifications', { professionalCredentials: v })}
            />
            <Multi
              label="Training completed (optional)"
              value={q.training}
              options={[
                ['methodology', 'Teaching methodology'],
                ['first_aid', 'First aid'],
                ['safeguarding', 'Child safeguarding'],
                ['learning_support', 'Learning support'],
                ['online', 'Online teaching'],
                ['other', 'Other'],
                ['none_yet', 'None yet'],
              ]}
              exclusive="none_yet"
              onChange={(v) => patch('qualifications', { training: v })}
            />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <p className="text-sm text-text-secondary">
              Provide at least one independent referee. Studdy will ask before contacting anyone
              marked “Contact me first”.
            </p>
            {draft.references.map((ref, i) => (
              <div className="space-y-3 rounded-lg border border-surface-border p-4" key={i}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Referee {i + 1}</h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand-purple"
                    onClick={() =>
                      change({ ...draft, references: draft.references.filter((_, j) => i !== j) })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Full name *"
                    value={ref.fullName}
                    onChange={(v) => setReference(i, { fullName: v })}
                  />
                  <SelectField
                    label="Referee category *"
                    value={ref.category}
                    options={REFEREE_TYPES}
                    onChange={(v) => setReference(i, { category: v })}
                  />
                  <TextField
                    label="Relationship to you *"
                    value={ref.relationship}
                    onChange={(v) => setReference(i, { relationship: v })}
                  />
                  <TextField
                    label="Organisation *"
                    value={ref.organisation}
                    onChange={(v) => setReference(i, { organisation: v })}
                  />
                  <TextField
                    label="Position *"
                    value={ref.position}
                    onChange={(v) => setReference(i, { position: v })}
                  />
                  <TextField
                    label="Email (or phone)"
                    type="email"
                    value={ref.email}
                    onChange={(v) => setReference(i, { email: v })}
                  />
                  <TextField
                    label="Phone (or email)"
                    type="tel"
                    value={ref.phone}
                    onChange={(v) => setReference(i, { phone: v })}
                  />
                </div>
                <Tick
                  checked={ref.permissionConfirmed}
                  label="I have my referee's permission for Studdy to contact them *"
                  onChange={(on) => setReference(i, { permissionConfirmed: on })}
                />
                <SelectField
                  label="When may Studdy contact this referee? *"
                  value={ref.contactPreference}
                  options={[
                    ['contact_now', 'Contact now'],
                    ['contact_me_first', 'Contact me first'],
                  ]}
                  onChange={(v) =>
                    setReference(i, { contactPreference: v as typeof ref.contactPreference })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-semibold text-brand-purple"
              onClick={() => change({ ...draft, references: [...draft.references, newRef()] })}
            >
              + Add referee
            </button>
            <div className="rounded-lg bg-brand-lavender p-3 text-sm">
              Studdy requires identity and safeguarding verification and an interview before
              approving tutors. Checks happen privately after submission.
            </div>
          </>
        ) : null}
        {step === 5 ? (
          <>
            <p className="text-sm text-text-secondary">
              These acknowledgements are separate. They do not establish that checks have been
              completed.
            </p>
            <Tick
              checked={d.accuracyAccepted}
              label="I confirm my application is accurate and I will report material changes *"
              onChange={(on) => patch('declarations', { accuracyAccepted: on })}
            />
            <Tick
              checked={d.safeguardingAccepted}
              label="I agree to complete Studdy's identity and safeguarding checks *"
              onChange={(on) => patch('declarations', { safeguardingAccepted: on })}
            />
            <Tick
              checked={d.codeOfConductAccepted}
              label="I agree to follow the Tutor Code of Conduct *"
              onChange={(on) => patch('declarations', { codeOfConductAccepted: on })}
            />
            <Tick
              checked={d.tutorAgreementAccepted}
              label="I accept the Tutor Agreement *"
              onChange={(on) => patch('declarations', { tutorAgreementAccepted: on })}
            />
            <Tick
              checked={d.privacyNoticeAccepted}
              label="I have read the Privacy Notice *"
              onChange={(on) => patch('declarations', { privacyNoticeAccepted: on })}
            />
            <Tick
              checked={d.interviewAccepted}
              label="I agree to a short interview and any required teaching demonstration *"
              onChange={(on) => patch('declarations', { interviewAccepted: on })}
            />
            <p className="rounded-lg bg-parent-gold-pale p-3 text-sm">
              Legal document links and acceptance version tracking are still being connected. Final
              submission remains unavailable in this development slice.
            </p>
          </>
        ) : null}
        {isReview ? (
          <>
            {STEP_NAMES.map((label, i) => (
              <div
                className="flex items-center justify-between gap-2 border-b border-surface-border pb-3"
                key={label}
              >
                <div>
                  <p className="text-sm font-semibold text-parent-navy">
                    {i + 1}. {label}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {
                      [
                        (a.preferredFirstName || 'No display name') +
                          ' · ' +
                          (a.location || 'Location missing'),
                        s.selections.length + ' subjects selected',
                        t.experience ? 'Experience provided' : 'Experience incomplete',
                        q.highestEducation ? 'Education provided' : 'Education incomplete',
                        draft.references.length + ' referees added',
                        Object.values(d).filter(Boolean).length + ' of 6 acknowledgements',
                      ][i]
                    }
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-purple underline"
                  onClick={() => setStep(i)}
                >
                  Edit
                </button>
              </div>
            ))}
            <div className="rounded-lg bg-brand-lavender p-4 text-sm">
              Your answers can be reviewed here. Final submission and human-review snapshots will be
              enabled after the backend verification stage.
            </div>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-surface-card-secondary px-4 py-3 text-sm font-semibold text-text-muted"
            >
              Submit application — coming in the next verified slice
            </button>
          </>
        ) : null}
      </section>
      <nav className="flex items-center justify-between gap-3" aria-label="Application steps">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="rounded-lg border border-surface-border px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          Back
        </button>
        {!isReview ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white"
          >
            {step === 5 ? 'Review answers' : 'Next step'} →
          </button>
        ) : null}
      </nav>
    </div>
  );
}
