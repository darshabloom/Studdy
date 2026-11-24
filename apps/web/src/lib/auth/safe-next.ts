/** Limit authentication return targets to local, path-based application routes. */
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) {
    return '/workspace';
  }

  try {
    const candidate = new URL(value, 'https://studdy.invalid');
    if (candidate.origin !== 'https://studdy.invalid') return '/workspace';
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return '/workspace';
  }
}
