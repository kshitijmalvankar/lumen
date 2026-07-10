import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { buildDigestHtml } from "@/lib/email/digest-html";

/**
 * Send the weekly digest to eligible users (weekly_digest on + at least one
 * watched topic + a known email). Uses the service-role admin client to read
 * across users; bounded per run to keep the cron cheap. Returns run stats.
 */
export async function sendWeeklyDigests(
  admin: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<{ processed: number; sent: number }> {
  const limit = opts.limit ?? 200;

  // Distinct users who track at least one topic.
  const { data: watchRows } = await admin
    .from("topic_watches")
    .select("user_id")
    .limit(5000);
  const userIds = [...new Set((watchRows ?? []).map((r) => r.user_id as string))].slice(
    0,
    limit,
  );

  let processed = 0;
  let sent = 0;
  for (const uid of userIds) {
    processed++;
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, display_name, weekly_digest")
        .eq("id", uid)
        .maybeSingle();
      const email = profile?.email as string | undefined;
      if (!email || profile?.weekly_digest === false) continue;

      const [{ data: w }, { data: it }] = await Promise.all([
        admin
          .from("topic_watches")
          .select("query")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(8),
        admin
          .from("interest_profile")
          .select("topic, weight")
          .eq("user_id", uid)
          .order("weight", { ascending: false })
          .limit(5),
      ]);

      const watches = (w ?? []).map((r) => r.query as string);
      const watchSet = new Set(watches.map((q) => q.toLowerCase()));
      const interests = (it ?? [])
        .map((r) => r.topic as string)
        .filter((t) => !watchSet.has(t.toLowerCase()));

      if (watches.length === 0 && interests.length === 0) continue;

      const html = buildDigestHtml({
        siteUrl: env.siteUrl,
        name: (profile?.display_name as string | null) ?? null,
        watches,
        interests,
      });
      const ok = await sendEmail({
        to: email,
        subject: "Your weekly Lumen digest",
        html,
      });
      if (ok) {
        sent++;
        await admin
          .from("topic_watches")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("user_id", uid);
      }
    } catch (err) {
      console.error("digest: failed for user", uid, err);
    }
  }
  return { processed, sent };
}
