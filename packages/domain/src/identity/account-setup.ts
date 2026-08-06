import { domainError } from '../core/errors';
import { fail, ok, type CommandResult } from '../core/result';

/**
 * Account setup (/welcome) rules — approved 6 Aug 2026.
 *
 * Self-serve role choices only. Manager and owner roles can never be created
 * through this path (invitation, seed or authorised assignment only).
 * Tutor choice creates a PENDING application state: no active tutor role, no
 * workspace, no access to student information.
 */
export const SELF_SERVE_ROLE_CHOICES = ['parent_guardian', 'independent_student', 'tutor'] as const;

export type SelfServeRoleChoice = (typeof SELF_SERVE_ROLE_CHOICES)[number];

export interface AccountSetupInput {
  readonly roleChoice: string;
  readonly preferredName: string;
  readonly familyName: string;
  /**
   * Approved launch product rule (NOT a final legal conclusion — review before
   * production): fully independent students must be 18+, self-declared.
   */
  readonly declaredEighteenPlus: boolean;
}

export interface ValidatedAccountSetup {
  readonly roleCode: SelfServeRoleChoice;
  readonly assignmentStatusCode: 'active' | 'pending';
  readonly workspaceEnabled: boolean;
  readonly preferredName: string;
  readonly familyName: string;
  readonly assignmentReasonCode: string;
}

const NAME_MAX = 100;

export function validateAccountSetup(
  input: AccountSetupInput,
): CommandResult<ValidatedAccountSetup> {
  const preferredName = input.preferredName.trim();
  const familyName = input.familyName.trim();
  const issues: Record<string, string> = {};

  if (preferredName.length === 0 || preferredName.length > NAME_MAX) {
    issues['preferredName'] = 'Enter the name you would like us to use.';
  }
  if (familyName.length === 0 || familyName.length > NAME_MAX) {
    issues['familyName'] = 'Enter your family name.';
  }
  if (!(SELF_SERVE_ROLE_CHOICES as readonly string[]).includes(input.roleChoice)) {
    issues['roleChoice'] = 'Choose who Studdy is for.';
  }

  const roleChoice = input.roleChoice as SelfServeRoleChoice;
  if (roleChoice === 'independent_student' && !input.declaredEighteenPlus) {
    issues['declaredEighteenPlus'] =
      'Independent student accounts require you to be 18 or older. Under 18? Ask a parent or guardian to create a family account.';
  }

  if (Object.keys(issues).length > 0) {
    return fail(domainError('VALIDATION_FAILED', 'Account setup input is invalid.', issues));
  }

  if (roleChoice === 'tutor') {
    return ok({
      roleCode: 'tutor',
      assignmentStatusCode: 'pending',
      workspaceEnabled: false,
      preferredName,
      familyName,
      assignmentReasonCode: 'self_registration_pending_application',
    });
  }

  return ok({
    roleCode: roleChoice,
    assignmentStatusCode: 'active',
    workspaceEnabled: true,
    preferredName,
    familyName,
    assignmentReasonCode:
      roleChoice === 'independent_student' ? 'self_declared_18_plus' : 'self_registration',
  });
}
