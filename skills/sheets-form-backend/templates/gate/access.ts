// Pre-launch password gate: shared helpers. Put at lib/access.ts.
// The cookie holds a hash derived from the password, so the password never sits in the browser
// and changing SITE_PASSWORD signs everyone out.

export const ACCESS_COOKIE = "site_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function accessToken(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`site-preview:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
