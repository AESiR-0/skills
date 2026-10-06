// Same-origin proxy: browser -> this route -> Apps Script -> Sheet.
// Next.js App Router route handler, e.g. app/api/submit/route.ts. Adapt the shape for other
// server frameworks; the rules stay the same.
//
// Why a proxy: the Apps Script URL and TOKEN stay server-side, validation happens before
// anything reaches the sheet, and the browser only ever sees an honest yes or no.
//
// Env (server-only, never NEXT_PUBLIC_):
//   SHEETS_WEBHOOK_URL    the /exec URL of the deployed web app
//   SHEETS_WEBHOOK_TOKEN  the same value as the script's TOKEN property

import { NextResponse } from "next/server";

// Keep in sync with CONFIG.FIELDS in Code.gs. Anything else in the body is dropped.
const FIELDS = ["name", "email", "phone", "message"] as const;
const MAX_LEN = 2000;
const MIN_FILL_MS = 2000; // faster than this is a bot
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5; // per IP, per server instance (best effort only)

// Apps Script takes 3 to 4 s warm and longer cold. A tight timeout reports failure for rows
// that were actually written.
const CHECK_TIMEOUT_MS = 10_000;
const SUBMIT_TIMEOUT_MS = 25_000;

const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_WEBHOOK_TOKEN;
  if (!url || !token) {
    // Fail closed and loudly. Never pretend a submission was stored.
    console.error("[form] SHEETS_WEBHOOK_URL or SHEETS_WEBHOOK_TOKEN is not set");
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  // Honeypot and fill-time: answer success so bots learn nothing, store nothing.
  const elapsed = Number(body.elapsedMs);
  if (body.website || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
    return NextResponse.json({ ok: true });
  }

  const action = body.action === "check" ? "check" : "submit";
  if (action === "submit") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(ip)) return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const payload: Record<string, unknown> = { action, token, source: String(body.source ?? "site").slice(0, 100) };
  for (const f of FIELDS) {
    const v = body[f];
    if (typeof v === "boolean") payload[f] = v;
    else if (v != null) payload[f] = String(v).trim().slice(0, MAX_LEN);
  }

  let res: Response;
  let data: { ok?: boolean; reason?: string; taken?: Record<string, boolean>; field?: string } | null;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow", // /exec answers with a 302 to script.googleusercontent.com
      cache: "no-store",
      signal: AbortSignal.timeout(action === "check" ? CHECK_TIMEOUT_MS : SUBMIT_TIMEOUT_MS),
    });
    data = await res.json().catch(() => null);
  } catch (err) {
    console.error("[form] sheet unreachable", err);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }

  // Apps Script answers 200 even for a wrong token or an error, and an expired deployment
  // returns an HTML sign-in page. Only an explicit ok === true counts.
  if (!res.ok || data?.ok !== true) {
    if (data?.reason === "taken") return NextResponse.json({ ok: false, taken: data.taken }, { status: 409 });
    if (data?.reason === "invalid") return NextResponse.json({ ok: false, field: data.field }, { status: 422 });
    console.error("[form] sheet write failed", res.status, data?.reason);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }

  if (action === "check") return NextResponse.json({ ok: true, taken: data.taken ?? {} });
  return NextResponse.json({ ok: true });
}
