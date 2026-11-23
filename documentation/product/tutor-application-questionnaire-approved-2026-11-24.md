# Studdy Tutor Application — approved questionnaire and implementation contract

Status: **All six questionnaire sections approved by product owner, 24 November 2026.**  
Tracking: [Shortcut SC-62](https://app.shortcut.com/studdy/story/62)  
Delivery base: `sc-42/google-primary-email-password-alternative` after approved SC-60 Tutor Home (PR #60, `9f9814a`).

## Scope and non-negotiables

- Replace the current single long application with **six progressive steps**, with automatically persisted drafts, an explicit saved/saving/error indicator and safe resumption on another session.
- An applicant may hold multiple roles on **one account**. Put this guidance near the start: “You can use one Studdy account as a tutor, parent or student. Add other roles and switch workspaces later; you do not need to register again.”
- Keep existing server-authoritative identity, role separation, RLS, safeguarding and human approvals. No automatic approval or direct public publication through this form.
- Keep the approved Tutor Home visuals, navigation, role/account menus, six-stage post-approval setup and calendar unchanged. This questionnaire is the **pre-approval application**; it is separate from the six-stage **post-approval tutor setup**.
- Production and real student data are untouched until separately verified and authorised.

## Step 1 — About you

1. **What is your full legal name?** Required. Legal first and family names.
2. **What first name should families see?** Required. Only this first name is public; legal family name is private.
3. **What is your date of birth?** Required. Used for age eligibility and 16–17 applicant safeguarding flow.
4. **What is your mobile number?** Required. Use international-format-aware validation and reasonable country coverage.
5. **Where are you based?** Required. Collect approximate location appropriate for matching, not a full residential address in the public application.
6. **Are you currently studying, working or both?** Optional, multi-select. Proposed categories: secondary-school student; university/tertiary student; school teacher; professional tutor; other. This optional field should not block submission.

For 16–17 year olds: automatically show the minor-specific consent/safeguarding path based on DOB, record any required guardian consent separately and enforce it before approval. Age eligibility policy currently starts at 16; keep it until an explicit product change.

## Step 2 — Subjects and levels

1. **Which subjects would you like to tutor?** Required, searchable, approved catalogue, multiselect. “Suggest a subject” records a pending catalogue request for staff review; suggestions alone must not silently create public subjects or qualify as verified offerings.
2. **Which education levels can you teach?** Required **per selected subject**, allowing distinct levels, e.g. Mathematics Years 7–13 and Physics Years 11–13. Existing levels include Preschool/Pre-K, Years 1–13, University Years 1–4, Postgraduate. Define explicit per-subject selection/ranges without assuming global contiguous proficiency.
3. **How would you like to teach?** Required: online, in person, or both.
4. **Which curriculum frameworks are you familiar with?** Required, multiselect. Options: NZ Curriculum, NCEA, Cambridge International, IB, Australian Curriculum, university-specific, Other, None yet. “None yet” is exclusive; an honest “None yet” satisfies the required answer.
5. **Are there particular topics you specialise in?** Optional free text **per subject**.

## Step 3 — Teaching experience

1. **How much teaching or tutoring experience do you have?** Required single select: None yet; less than 1 year; 1–2 years; 3–5 years; 6–10 years; more than 10 years.
2. **In what settings have you taught or tutored?** Required multi-select: private tutoring; school classroom; university/tertiary; group tutoring; online tutoring; informal help for friends/family; None yet; Other. None yet is exclusive.
3. **How would you describe your teaching approach?** Required free text; current minimum 40 characters is the retained baseline, with helpful prompts.
4. **Which types of students have you worked with?** Required multi-select: primary school; intermediate; secondary school; university/tertiary; adult learners; No previous students. “No previous students” is a valid exclusive response.
5. **Do you have experience supporting particular learning needs?** Optional multi-select: ADHD, dyslexia, autism, learning difficulties, English as an additional language, gifted learners, exam anxiety, Other, No specific experience. These are tutor self-reports, not specialist certifications or student records.
6. **Tell us about a time you helped someone learn something.** Optional free text. Instruct applicants to avoid identifying any student.
7. **Public headline** is intentionally **removed** from the application and edited **after approval** in tutor profile setup.

## Step 4 — Qualifications and evidence

1. **What is your highest completed level of education?** Required, single select. Choices to implement: secondary school/currently attending; NCEA Level 1, 2, or 3; certificate; diploma; bachelor's degree; postgraduate qualification; other. Keep mutually exclusive and semantically clear for currently studying applicants.
2. **Are you currently studying towards a qualification?** Required Yes/No. If Yes: qualification, institution, expected completion year.
3. **What qualifications or certifications do you hold that are relevant to tutoring?** Required **to answer**, with repeatable name, institution, field, award year and valid “No relevant qualifications yet”.
4. **Would you provide evidence of your qualifications?** Required **to answer**, including “I'll provide my supporting documents later” (through secure profile evidence workflow), plus appropriate other evidence responses. Choosing later cannot be represented as verified.
5. **Would you like to share academic results relevant to the subjects you tutor?** Optional; claimed results stay unverified until evidence reviewed.
6. **Do you hold any teaching or professional credentials?** Optional, with 'None'.
7. **Have you completed any tutoring, teaching or child-safeguarding training?** Optional with 'None yet', and details if supplied.

**Evidence collection occurs later through private verification**, and post-approval profile evidence can be supplemented later. Do not build uncontrolled public document uploads. Verification/qualification badges require actual review; mandatory identity and safeguarding checks still gate approval.

## Step 5 — Referees and checks

1. **How many referees can you provide?** Require **one** valid independent referee for submission; additional referees optional.
2. **Who may act as a referee?** Teacher/lecturer; school leader; employer/supervisor; previous tutoring client; coach/mentor; community leader; Other subject to human assessment. Close relatives and personal friends should not be automatically treated as independent.
3. **Referee details**: full name, relationship, organisation, position, and **email OR phone** (either or both). The earlier email-only validation is superseded.
4. **Have you asked your referees for permission to be contacted by Studdy?** Required affirmative confirmation for each referee.
5. **When may Studdy contact them?** Required choice: Contact now / Contact me first. Do not contact automatically in “Contact me first”.
6. Explain identity and safeguarding checks here, with required acknowledgement at final declarations.
7. **Are you willing to participate in a short interview or teaching demonstration?** Required response/commitment; the existing mandatory interview check must remain. Do not imply a demonstration was completed from the checkbox.

The application submission threshold of one referee does not automatically lower staff approval readiness or mandatory reference/identity/safeguarding checks.

## Step 6 — Declarations and submission

1. Confirm all information accurate, and report material changes — REQUIRED.
2. Compute minor status from DOB; show 16–17 relevant safeguards without redundant age question.
3. Agree to complete identity and safeguarding checks — REQUIRED.
4. Accept Tutor Code of Conduct — REQUIRED.
5. Accept Tutor Agreement and Privacy Notice — REQUIRED. Render links, track document versions and timestamped, auditable acceptances (as appropriate separately).
6. Explain that operational contact concerning application and verification is part of applying. Marketing opt-in, if ever offered, is separate and optional.
7. **Required review screen** with a summary of all six sections, Edit links, clear errors and final Submit action.
8. After submission show **application status dashboard**, next steps and outstanding actions. Never imply approval before checks complete.
9. Auto-save drafts throughout, persist progress, offer feedback for saving, saved, retry and failure; avoid overwrite races, tab collisions and lost data. Final submission validates on the trusted server.

## Implementation work packages (in dependency order)

### A. Model, migration and secure access
- Inspect current application snapshot/revision persistence, access policies, age model and reviewer read projections.
- Create versioned, reviewed migrations for DOB, contact/location, education/work status, per-subject levels and specialisations, curricula, experience, education/credentials claims, revised referees, evidence intent, declaration versioning and draft step progression.
- Avoid copying personal data to test; test with synthetic records. Protect date of birth, contact and reference details against public reads and inappropriate cross-role access.
- Plan compatibility and backfill for existing drafts; never silently discard old application answers.

### B. Domain model and validation
- Update types, parsers, draft representation and submit-time validation; draft saving accepts incomplete steps.
- Validate required responses, per-subject level mapping, exclusive 'None yet' answers, referee email-or-phone and permission/contact timing, DOB/age checks, required documents/declarations and immutable submitted snapshot.
- Review/minor safeguarding and conditional approvals remain server-authoritative.

### C. Six-step application UI
- Replace long page with a progressive six-step UI plus explicit final review screen; reusable branded inputs, progress indicator, responsive form and accessible controls.
- Durable auto-save, visible status, resume, previous/next and editing previous steps; clear error recovery.
- Preserve Google-first and email/password sign-in, multi-role identity and current branding.

### D. Human review and evidence
- Reviewer can understand new structured answers, verify reference contact preferences, record independent checks and assess subject suggestions.
- Support secure deferred evidence after submitting and later from profile; no qualification badge until verified. This is explicitly an evidence pathway, not an expansion into a credential marketplace.

### E. Regression and preview verification
- Domain/unit tests, migration/idempotency, RLS and access isolation, application snapshot and resumption, responsive Playwright flows including 16–17-year-old applicants and incomplete referee data.
- Four GitHub CI jobs green; protected Vercel Preview desktop/mobile verified; no production merge/deployment without defined release gates.

## Pending implementation clarifications, not silently assumed

- How long draft DOB/referee data are retained, including withdrawn/rejected applications; privacy notice and deletion policy must be settled before production collection.
- Exact text/versions of Tutor Agreement, Code of Conduct and Privacy Notice, and required parent/guardian consent workflow for minors.
- How staff review catalogued subject suggestions and what to do when the only requested subject has not yet been approved.
- Whether the existing reviewer interface and backend schema support non-email referees; must be updated atomically.
- Existing profile creation requires a headline today; move that requirement to post-approval setup in a safe state transition, without generating fictitious public content.
