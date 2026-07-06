import "server-only";
import { env } from "@/lib/env";

const HUME_TTS_FILE_URL = "https://api.hume.ai/v0/tts/file";

// A consistent narrator persona so segments sound like one voice. Override with
// HUME_VOICE_DESCRIPTION.
const DEFAULT_VOICE_DESCRIPTION =
  "A warm, articulate narrator with a calm, measured, public-radio delivery — clear and engaging, never rushed.";

/**
 * Synthesize one script segment (≤5,000 chars) to MP3 via Hume Octave. Returns
 * the raw audio bytes. Each call is independent, so it fits inside a single
 * serverless invocation.
 */
export async function synthesizeSegment(text: string): Promise<Buffer> {
  const description = env.humeVoiceDescription || DEFAULT_VOICE_DESCRIPTION;

  const res = await fetch(HUME_TTS_FILE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hume-Api-Key": env.humeApiKey,
    },
    body: JSON.stringify({
      utterances: [{ text, description }],
      format: { type: "mp3" },
      num_generations: 1,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Hume TTS ${res.status}: ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
