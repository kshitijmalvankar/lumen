import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPaths } from "./storage";

export type AudioStatus = "synthesizing" | "ready" | "error";

export interface AudioSegmentRow {
  index: number;
  text: string;
  path: string | null;
}

export interface AudioOverviewRow {
  id: string;
  summaryId: string;
  status: AudioStatus;
  segments: AudioSegmentRow[];
  error: string | null;
}

/** Client-facing status: playable (signed) URLs per segment + progress. */
export interface AudioOverviewStatus {
  status: "none" | AudioStatus;
  total: number;
  ready: number;
  segments: { index: number; url: string | null }[];
  error?: string;
}

const ROW_COLUMNS = "id, summary_id, status, segments, error";

function mapRow(row: Record<string, unknown>): AudioOverviewRow {
  return {
    id: row.id as string,
    summaryId: row.summary_id as string,
    status: (row.status as AudioStatus) ?? "synthesizing",
    segments: Array.isArray(row.segments)
      ? (row.segments as AudioSegmentRow[])
      : [],
    error: (row.error as string | null) ?? null,
  };
}

export async function loadOverviewRow(
  supabase: SupabaseClient,
  summaryId: string,
): Promise<AudioOverviewRow | null> {
  const { data } = await supabase
    .from("audio_overviews")
    .select(ROW_COLUMNS)
    .eq("summary_id", summaryId)
    .maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Create/replace the row for a freshly generated script (paths start null). */
export async function createOverviewRow(
  supabase: SupabaseClient,
  userId: string,
  summaryId: string,
  script: string,
  segmentTexts: string[],
): Promise<AudioOverviewRow> {
  const segments: AudioSegmentRow[] = segmentTexts.map((text, index) => ({
    index,
    text,
    path: null,
  }));

  const { data, error } = await supabase
    .from("audio_overviews")
    .upsert(
      {
        user_id: userId,
        summary_id: summaryId,
        status: "synthesizing",
        script,
        segments,
        error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "summary_id" },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) throw new Error(`createOverviewRow: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

/** Record a synthesized segment's path; flip to `ready` once all are present. */
export async function saveSegmentPath(
  supabase: SupabaseClient,
  summaryId: string,
  index: number,
  path: string,
): Promise<AudioOverviewRow> {
  const row = await loadOverviewRow(supabase, summaryId);
  if (!row) throw new Error("Audio overview not found.");

  const segments = row.segments.map((s) =>
    s.index === index ? { ...s, path } : s,
  );
  const allReady = segments.length > 0 && segments.every((s) => s.path);

  const { data, error } = await supabase
    .from("audio_overviews")
    .update({
      segments,
      status: allReady ? "ready" : "synthesizing",
      updated_at: new Date().toISOString(),
    })
    .eq("summary_id", summaryId)
    .select(ROW_COLUMNS)
    .single();
  if (error) throw new Error(`saveSegmentPath: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function markOverviewError(
  supabase: SupabaseClient,
  summaryId: string,
  message: string,
): Promise<void> {
  await supabase
    .from("audio_overviews")
    .update({
      status: "error",
      error: message.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("summary_id", summaryId);
}

/** Turn a row into the client status, signing the URLs of ready segments. */
export async function toStatus(
  row: AudioOverviewRow | null,
): Promise<AudioOverviewStatus> {
  if (!row) return { status: "none", total: 0, ready: 0, segments: [] };

  const readyPaths = row.segments
    .map((s) => s.path)
    .filter((p): p is string => Boolean(p));
  const signed = await signPaths(readyPaths);

  const segments = row.segments.map((s) => ({
    index: s.index,
    url: s.path ? (signed[s.path] ?? null) : null,
  }));

  return {
    status: row.status,
    total: row.segments.length,
    ready: readyPaths.length,
    segments,
    error: row.error ?? undefined,
  };
}
