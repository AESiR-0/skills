---
name: sheets-form-backend
description: Wire website forms (contact, waitlist, request access, multi-step wizards) to a Google Sheet through a Google Apps Script web app, with honest success reporting, a shared secret, duplicate blocking, spam guards and an optional pre-launch password gate. Use when the user wants form submissions in Google Sheets, a free form backend, a waitlist or coming-soon page, or reports forms that "say success but nothing arrives".
---

A free, serverless form backend: the sheet is the database, Apps Script is the only writer. The templates in `templates/` are proven in production; adapt them, don't reinvent them.

**The one rule above all: never fake success.** A form that says "Thanks!" while nothing was stored is worse than a broken form. Success is shown only when the sheet answered `ok: true`.

## 1. Interview

One AskUserQuestion call, covering what the request leaves open:
- **Fields**: which ones, which are required, and their types (text, email, phone, bool).
- **Duplicates**: block repeats by email, by phone, both, or allow them. This matters whenever each row costs money downstream, e.g. a CRM funnel.
- **Runtime**: whether the site has a server (Next.js or another framework with API routes) or is purely static.
- **Gate**: whether the site needs a pre-launch password page with only the waitlist public.
- **Notify**: whether each submission should also be emailed to someone.

Done when: fields, unique keys, runtime, gate and notify are all decided.

## 2. Architecture

**With a server (default):** browser → same-origin `/api/submit` → server `fetch` to the Apps Script `/exec` URL → `doPost` → sheet. The URL and token never reach the browser. Use `templates/route.ts`.

**Static site (no server):** the browser POSTs straight to `/exec` with `Content-Type: text/plain;charset=utf-8`, which avoids a CORS preflight and still lets you read the JSON reply.
- Never use `mode: "no-cors"`. Its response is opaque, so every outcome looks like success.
- Say plainly to the user that the token is visible in a static bundle. It only deters drive-by spam, so the duplicate check and honeypot carry the weight.

## 3. Build

1. **Apps Script.** Copy `templates/Code.gs`. Edit only `CONFIG`: `SERVICE`, `SHEET_NAME`, `FIELDS` and `UNIQUE`. The template already handles:
   - Token check: fails closed, with a constant-time compare. The token goes in the body because Apps Script cannot read headers.
   - Header row: ensured on every request.
   - Phone columns: stored as text.
   - Cell safety: formula-injection guard and length caps.
   - Duplicates: normalised keys (lowercased email, last 10 phone digits), checked again inside `LockService` so two simultaneous submits can't both pass.
   - Status: a `VERSION` in `doGet`.
   - Save the file in the repo, e.g. `apps-script/Code.gs`, so it is versioned with the site.
2. **Server route.** Copy `templates/route.ts` and keep its `FIELDS` in sync with `CONFIG.FIELDS`. The rules it encodes:
   - **Success:** only when `res.ok && data.ok === true`. Apps Script answers HTTP 200 even for a wrong token, and an expired deployment returns an HTML page, so the status alone proves nothing.
   - **Status codes:** `taken` → 409, `invalid` → 422, everything else → 502 with a server log.
   - **Missing env vars:** 503, never a silent "joined".
   - **Timeouts:** 10 s for a check, 25 s for a submit. Apps Script cold starts are slow, and a tight timeout reports failure for rows that were actually written.
   - **Bots:** a honeypot field (`website`) and a minimum fill time (`elapsedMs` under 2 s) return a fake `ok` so bots learn nothing. This is the only fake success allowed.
   - **Rate limit:** a per-IP limit as a best-effort extra.
3. **Client.**
   - Disable the button while sending.
   - Show success only when the route returns `ok: true`, and play any completion animation on that answer, not on click.
   - On 409, say what is already registered. On any other failure, show a real error with a fallback contact (email or WhatsApp).
   - Send `elapsedMs` (now minus form mount time) and render the honeypot input visually hidden, with `tabIndex={-1}` and `autoComplete="off"`.
   - For wizards, call `action: "check"` on blur of email and phone and before the next step, and stay quiet if the check itself fails. The submit re-check is the real gate.
4. **Gate (optional).** Copy `templates/gate/` into the project:
   - `access.ts` goes in `lib/`.
   - `proxy.ts` goes at the root. Name it `middleware.ts` on Next 15 or older.
   - `actions.ts` goes beside the gate page.
   - Build the gate page in the site's own design. Keep it subtle: one password field.
   - A missing `SITE_PASSWORD` keeps the site locked.
   - Add every route the gate page needs (form API, assets) to `PUBLIC`.
5. **Env.** Add the variables to `.env.example` with no values: `SHEETS_WEBHOOK_URL`, `SHEETS_WEBHOOK_TOKEN`, and `SITE_PASSWORD` if the gate is used. Never commit real values, and never hardcode the `/exec` URL or a password as a fallback default.

Done when: the script, route, client and (if chosen) gate are in place, the project typechecks, and no secret or URL appears in tracked files (`git grep -n "script.google.com/macros"` finds nothing outside docs).

## 4. Hand-off: the steps only the user can do

Give the user these steps verbatim, filled in for their project:
1. Create the Sheet. Then Extensions → Apps Script, paste `Code.gs`, and save.
2. In Project Settings → Script properties, add `TOKEN` (`openssl rand -hex 32`) and optionally `NOTIFY_EMAIL`.
3. Run `setup` once and approve the permissions ("unverified app" → Advanced → Go to project).
4. Deploy → New deployment → Web app. Execute as **Me**, access **Anyone**. Copy the `/exec` URL, not `/dev`.
5. Put the URL and token into the host's env (Production and Preview) and `.env.local`, then **redeploy the site**.
6. **After any later `Code.gs` edit:** Manage deployments → pencil → Version: **New version**. A "New deployment" creates a new URL while the old one keeps serving stale code. Bump `VERSION` each time.

## 5. Verify

- Open the `/exec` URL in a browser. It should show `{ok:true, service, version}` with the expected version.
- Submit one real row through the site and confirm it appears in the sheet.
- Submit the same email again and confirm the 409 message.
- Unset the URL env locally and confirm the form shows an error, not success.
- If the user hasn't deployed yet, say which of these checks are still pending rather than claiming the form works.
