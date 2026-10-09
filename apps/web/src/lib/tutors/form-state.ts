/** What a tutor-application form action reports back to the form. */
export interface TutorFormState {
  readonly error: string | null;
  readonly message: string | null;
  readonly issues: Readonly<Record<string, string>>;
}

export const INITIAL_TUTOR_FORM_STATE: TutorFormState = { error: null, message: null, issues: {} };
