import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvironmentCache } from './environment';
import { assertDestructiveCommandAllowed, EnvironmentSafetyError } from './safety';

describe('assertDestructiveCommandAllowed', () => {
  afterEach(() => {
    resetEnvironmentCache();
    delete process.env['STUDDY_ENVIRONMENT'];
  });

  it('allows destructive commands in local by default', () => {
    process.env['STUDDY_ENVIRONMENT'] = 'local';
    expect(() => assertDestructiveCommandAllowed('db:reset')).not.toThrow();
  });

  it('refuses when the environment is not allow-listed', () => {
    process.env['STUDDY_ENVIRONMENT'] = 'development';
    expect(() => assertDestructiveCommandAllowed('db:reset')).toThrow(EnvironmentSafetyError);
  });

  it('never allows staging or production to be allow-listed', () => {
    process.env['STUDDY_ENVIRONMENT'] = 'production';
    expect(() => assertDestructiveCommandAllowed('db:reset', ['production'])).toThrow(
      EnvironmentSafetyError,
    );
  });

  it('defaults to local when STUDDY_ENVIRONMENT is unset — unclear targets fail safely', () => {
    process.env['STUDDY_ENVIRONMENT'] = 'staging';
    expect(() => assertDestructiveCommandAllowed('db:reset')).toThrow(EnvironmentSafetyError);
  });
});
