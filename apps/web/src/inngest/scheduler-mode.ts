/**
 * Hosted previews must opt in to expiry alone. Production and local retain
 * their existing registration; an unknown environment registers nothing.
 */
export type SchedulerMode = 'all' | 'expiry-only' | 'disabled';

export function schedulerMode(
  environment: string | undefined,
  expiryEnabled: string | undefined,
  vercelEnvironment: string | undefined,
  gitBranch: string | undefined,
): SchedulerMode {
  if (vercelEnvironment === 'preview') {
    return environment === 'development' && gitBranch === 'development' && expiryEnabled === 'true'
      ? 'expiry-only'
      : 'disabled';
  }
  if (vercelEnvironment === 'production') {
    return environment === 'production' ? 'all' : 'disabled';
  }
  if (vercelEnvironment !== undefined) return 'disabled';
  return environment === 'local' || environment === undefined ? 'all' : 'disabled';
}
