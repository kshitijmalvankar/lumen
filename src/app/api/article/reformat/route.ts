import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/billing/entitlements";
import { reformatArticle } from "@/lib/article/reformat";
import { FORMAT_IDS } from "@/lib/ai/formats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full re-generation; 300s only takes effect on Vercel Pro.
export const maxDuration = 300;

const bodySchema = z.object({
  summaryId: z.string().uuid(),
  format: z.enum(FORMAT_IDS as [string, ...string[]]),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return jsonError("The app isn't fully configured yet.", 503);
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Pick a format to switch to.", 400);
  const { summaryId, format } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in.", 401);

  // Reformatting re-runs the model — a Pro/Max capability.
  const tier = await getUserTier(supabase, user.id);
  if (tier === "free") {
    return jsonError("Changing an article's format is available on Pro and Max.", 403);
  }

  try {
    const res = await reformatArticle(supabase, user.id, summaryId, format);
    if (!res.ok) return jsonError(res.error ?? "Couldn't reformat.", 422);
    return Response.json({ ok: true, format });
  } catch (err) {
    console.error("reformat error:", err);
    return jsonError("Couldn't reformat that article right now.", 500);
  }
}
