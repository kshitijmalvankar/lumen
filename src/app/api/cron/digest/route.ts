import { env, isEmailConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigests } from "@/lib/email/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when the
// CRON_SECRET env var is set. We also accept `?secret=` for manual triggers.
function authorized(req: Request): boolean {
  if (!env.cronSecret) return false;
  if (req.headers.get("authorization") === `Bearer ${env.cronSecret}`) return true;
  return new URL(req.url).searchParams.get("secret") === env.cronSecret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return Response.json({ skipped: "email not configured" });
  }
  try {
    const admin = createAdminClient();
    const stats = await sendWeeklyDigests(admin);
    return Response.json({ ok: true, ...stats });
  } catch (err) {
    console.error("digest cron error:", err);
    return Response.json({ error: "digest failed" }, { status: 500 });
  }
}
