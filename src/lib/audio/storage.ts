import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "audio";

/** Upload one MP3 segment; returns its storage path. Overwrites on retry. */
export async function uploadSegment(
  summaryId: string,
  index: number,
  data: Buffer,
): Promise<string> {
  const admin = createAdminClient();
  const path = `${summaryId}/${index}.mp3`;
  const { error } = await admin.storage.from(BUCKET).upload(path, data, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) throw new Error(`uploadSegment: ${error.message}`);
  return path;
}

/** Short-lived signed URLs for a set of stored paths, keyed by path. */
export async function signPaths(
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const d of data) {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  }
  return map;
}
