import { describe, expect, it } from 'vitest';
import { validateAccountSetup } from './account-setup';

const base = {
  preferredName: 'Aroha',
  familyName: 'Ngata',
  declaredEighteenPlus: false,
};

describe('validateAccountSetup', () => {
  it('parent path becomes an active assignment with a workspace', () => {
    const result = validateAccountSetup({ ...base, roleChoice: 'parent_guardian' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assignmentStatusCode).toBe('active');
      expect(result.value.workspaceEnabled).toBe(true);
    }
  });

  it('independent student requires the 18+ declaration (approved launch rule)', () => {
    const refused = validateAccountSetup({ ...base, roleChoice: 'independent_student' });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('VALIDATION_FAILED');
      expect(refused.error.details).toHaveProperty('declaredEighteenPlus');
    }
    const allowed = validateAccountSetup({
      ...base,
      roleChoice: 'independent_student',
      declaredEighteenPlus: true,
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.value.assignmentReasonCode).toBe('self_declared_18_plus');
    }
  });

  it('tutor path is pending with no workspace — no active tutor role from self-registration', () => {
    const result = validateAccountSetup({ ...base, roleChoice: 'tutor' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assignmentStatusCode).toBe('pending');
      expect(result.value.workspaceEnabled).toBe(false);
    }
  });

  it('manager and owner can never be chosen through self-serve setup', () => {
    for (const roleChoice of ['platform_manager', 'platform_owner', 'organisation_manager']) {
      const result = validateAccountSetup({ ...base, roleChoice });
      expect(result.ok).toBe(false);
    }
  });

  it('requires both names and trims whitespace', () => {
    expect(
      validateAccountSetup({ ...base, preferredName: '  ', roleChoice: 'parent_guardian' }).ok,
    ).toBe(false);
    expect(
      validateAccountSetup({ ...base, familyName: '', roleChoice: 'parent_guardian' }).ok,
    ).toBe(false);
    const result = validateAccountSetup({
      ...base,
      preferredName: '  Aroha ',
      roleChoice: 'parent_guardian',
    });
    if (result.ok) expect(result.value.preferredName).toBe('Aroha');
  });
});
