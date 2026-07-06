import { z } from "zod";
import { authorizeMaxAudio } from "@/lib/audio/guard";
import { synthesizeSegment } from "@/lib/audio/hume";
import { uploadSegment, signPaths } from "@/lib/audio/storage";
import {
  loadOverviewRow,
  saveSegmentPath,
  markOverviewError,
} from "@/lib/audio/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One segment (≤5k chars) synthesizes fast; each call is its own fresh budget.
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

const bodySchema = z.object({
  summaryId: z.string().uuid(),
  index: z.number().int().min(0),
});

export async function POST(req: Request) {
  const auth = await authorizeMaxAudio();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.", 400);
  const { summaryId, index } = parsed.data;

  const row = await loadOverviewRow(supabase, summaryId);
  if (!row) return jsonError("Audio overview not found.", 404);

  const segment = row.segments.find((s) => s.index === index);
  if (!segment) return jsonError("Segment out of range.", 400);

  // Already synthesized (idempotent resume) → just hand back a fresh signed URL.
  if (segment.path) {
    const signed = await signPaths([segment.path]);
    return Response.json({
      index,
      url: signed[segment.path] ?? null,
      done: row.status === "ready",
    });
  }

  try {
    const audio = await synthesizeSegment(segment.text);
    const path = await uploadSegment(summaryId, index, audio);
    const updated = await saveSegmentPath(supabase, summaryId, index, path);
    const signed = await signPaths([path]);
    return Response.json({
      index,
      url: signed[path] ?? null,
      done: updated.status === "ready",
    });
  } catch (err) {
    console.error("audio segment synth error:", err);
    await markOverviewError(
      supabase,
      summaryId,
      err instanceof Error ? err.message : "synthesis failed",
    );
    return jsonError("Couldn't synthesize that segment. Please try again.", 500);
  }
}
