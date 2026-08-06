/** Helpers for the local Mailpit inbox (Supabase local email testing). */

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:14324';

interface MailpitMessageSummary {
  ID: string;
  To: Array<{ Address: string }>;
  Created: string;
}

/** Poll Mailpit for the newest message to an address and return one action link from its body. */
export async function fetchEmailLink(
  toAddress: string,
  linkPattern: RegExp,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${toAddress}`)}&limit=5`,
    );
    if (search.ok) {
      const payload = (await search.json()) as { messages?: MailpitMessageSummary[] };
      const [newest] = payload.messages ?? [];
      if (newest !== undefined) {
        const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`);
        if (detail.ok) {
          const message = (await detail.json()) as { Text?: string; HTML?: string };
          const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`;
          const match = body.match(linkPattern);
          const link = match?.[0];
          if (link !== undefined) {
            return link.replace(/&amp;/g, '&');
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`No email with a matching link arrived for ${toAddress} within ${timeoutMs}ms`);
}

/**
 * Follow a Supabase action link (verify / recovery) in Node and return the
 * application URL it redirects to (e.g. http://localhost:3000/verify?code=…).
 * The browser then only navigates to the app — token verification happens
 * here, which is more reliable than pointing the browser at the local
 * Supabase container.
 */
export async function resolveEmailAction(link: string): Promise<string> {
  const response = await fetch(link, { redirect: 'manual' });
  const location = response.headers.get('location');
  if (location === null) {
    throw new Error(`Supabase action link did not redirect (status ${response.status}): ${link}`);
  }
  // Return a relative URL so page.goto() applies Playwright's baseURL — the
  // configured site URL (port 3000) differs from the e2e server port.
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}
