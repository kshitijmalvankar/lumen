import { z } from "zod";
import { checkAudioRateLimit } from "@/lib/cache/redis";
import { blocksToMarkdown } from "@/lib/library/queries";
import { categorizeModel } from "@/lib/ai/models";
import { buildAudioScript, segmentScript } from "@/lib/ai/audio-script";
import { authorizeMaxAudio } from "@/lib/audio/guard";
import {
  loadOverviewRow,
  createOverviewRow,
  toStatus,
} from "@/lib/audio/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Script generation runs here; 300s needs Vercel Pro (Hobby clamps to 60s),
// but generation fits comfortably inside 60s on its own.
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

const bodySchema = z.object({ summaryId: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await authorizeMaxAudio();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Missing article id.", 400);
  const { summaryId } = parsed.data;

  // Already generated (or mid-generation) → return current status so the client
  // resumes remaining segments instead of paying for a new script.
  const existing = await loadOverviewRow(supabase, summaryId);
  if (existing && existing.status !== "error") {
    return Response.json(await toStatus(existing));
  }

  const rl = await checkAudioRateLimit(supabase, user.id);
  if (!rl.allowed) {
    return jsonError(
      `You've reached the daily limit of ${rl.limit} audio overviews. Try again tomorrow.`,
      429,
    );
  }

  // Load the article (RLS scopes to the owner).
  const { data: summary, error: sumErr } = await supabase
    .from("summaries")
    .select("id, title")
    .eq("id", summaryId)
    .maybeSingle();
  if (sumErr) return jsonError("Couldn't load that article.", 500);
  if (!summary) return jsonError("Article not found.", 404);

  const { data: blocksData } = await supabase
    .from("summary_blocks")
    .select("type, content, position")
    .eq("summary_id", summaryId)
    .order("position", { ascending: true });
  const blocks = (blocksData ?? []) as Array<{
    type: "text" | "heading";
    content: string;
  }>;
  const articleMarkdown = blocksToMarkdown(blocks);

  try {
    const script = await buildAudioScript({
      model: categorizeModel(),
      title: (summary.title as string) ?? "",
      articleMarkdown,
    });
    const segments = segmentScript(script);
    if (segments.length === 0) {
      return jsonError("There wasn't enough content to narrate.", 422);
    }

    const row = await createOverviewRow(
      supabase,
      user.id,
      summaryId,
      script,
      segments,
    );
    return Response.json(await toStatus(row));
  } catch (err) {
    console.error("audio overview script error:", err);
    return jsonError("Couldn't prepare the audio. Please try again.", 500);
  }
}

export async function GET(req: Request) {
  const auth = await authorizeMaxAudio();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const summaryId = new URL(req.url).searchParams.get("summaryId") ?? "";
  if (!z.string().uuid().safeParse(summaryId).success) {
    return jsonError("Missing article id.", 400);
  }

  const row = await loadOverviewRow(supabase, summaryId);
  return Response.json(await toStatus(row));
}
