import { z } from "zod";
import {
  isSupabaseConfigured,
  isEmbeddingsConfigured,
  isExtendedCompute,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/billing/entitlements";
import {
  indexSummary,
  backfillEmbeddings,
} from "@/lib/library/embeddings-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Embedding a batch of articles is its own fresh budget (stacked request), kept
// off the 60s search path.
export const maxDuration = 300;

const bodySchema = z.object({ summaryId: z.string().uuid().optional() });

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured() || !isEmbeddingsConfigured()) {
    return jsonError("Library Intelligence isn't configured.", 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in.", 401);

  // Only paid users get their libraries indexed (controls embedding spend).
  const tier = await getUserTier(supabase, user.id);
  if (tier === "free") {
    return jsonError("Library Intelligence is available on Pro and Max.", 403);
  }

  const parsed = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  const summaryId = parsed.success ? parsed.data.summaryId : undefined;

  try {
    if (summaryId) {
      const n = await indexSummary(supabase, user.id, summaryId);
      return Response.json({ indexed: n > 0 ? 1 : 0, remaining: 0 });
    }
    // On extended compute (300s) chew through a much larger batch per call, so a
    // big library finishes in a couple of round-trips instead of dozens.
    const res = await backfillEmbeddings(
      supabase,
      user.id,
      isExtendedCompute() ? 40 : 10,
    );
    return Response.json(res);
  } catch (err) {
    console.error("library index error:", err);
    return jsonError("Couldn't index your library right now.", 500);
  }
}
