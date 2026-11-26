import { describe, expect, it } from 'vitest';
import { schedulerMode } from './scheduler-mode';

describe('scheduled job registration', () => {
  it('requires explicit opt-in on the stable development preview', () => {
    expect(schedulerMode('development', 'true', 'preview', 'development')).toBe('expiry-only');
    expect(schedulerMode('development', undefined, 'preview', 'development')).toBe('disabled');
    expect(schedulerMode('development', 'false', 'preview', 'development')).toBe('disabled');
  });

  it('disables feature previews even if the opt-in is present', () => {
    expect(schedulerMode('development', 'true', 'preview', 't02a/hold-expiry')).toBe('disabled');
    expect(schedulerMode('development', 'true', 'preview', undefined)).toBe('disabled');
    expect(schedulerMode('production', 'true', 'preview', 'development')).toBe('disabled');
    expect(schedulerMode(undefined, 'true', 'preview', 'development')).toBe('disabled');
  });

  it('preserves existing production registration only on a production target', () => {
    expect(schedulerMode('production', undefined, 'production', 'main')).toBe('all');
    expect(schedulerMode('development', 'true', 'production', 'main')).toBe('disabled');
    expect(schedulerMode(undefined, undefined, 'production', 'main')).toBe('disabled');
  });

  it('preserves local testing and refuses unknown hosted environments', () => {
    expect(schedulerMode('local', undefined, undefined, undefined)).toBe('all');
    expect(schedulerMode(undefined, undefined, undefined, undefined)).toBe('all');
    expect(schedulerMode('development', 'true', undefined, 'development')).toBe('disabled');
    expect(schedulerMode('staging', 'true', 'staging', 'development')).toBe('disabled');
  });
});
