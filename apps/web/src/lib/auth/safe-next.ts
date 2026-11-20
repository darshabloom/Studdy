/** Keep authentication return paths within Studdy even when a next URL is user-supplied. */
export function safeAuthNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/workspace';
  }
  try {
    const url = new URL(next, 'https://studdy.invalid');
    if (url.origin !== 'https://studdy.invalid') return '/workspace';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/workspace';
  }
}
