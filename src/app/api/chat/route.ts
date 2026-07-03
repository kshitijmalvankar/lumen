import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkChatRateLimit } from "@/lib/cache/redis";
import { getUserTier } from "@/lib/billing/entitlements";
import { blocksToMarkdown } from "@/lib/library/queries";
import { streamChatAnswer, type ChatSource, type ChatTurn } from "@/lib/ai/chat";
import { modelSlug, isThinkingSlug } from "@/lib/ai/model-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  summaryId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

// Follow-ups default to the article's own model; Opus if it wasn't recorded.
const FALLBACK_MODEL = modelSlug("claude-opus");

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Ask a question to continue.", 400);
  const { summaryId, message } = parsed.data;

  if (!isSupabaseConfigured()) {
    return jsonError("The app isn't fully configured yet.", 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in.", 401);

  // Follow-up chat is a Max-only feature.
  const tier = await getUserTier(supabase, user.id);
  if (tier !== "max") {
    return jsonError("Follow-up chat is available on the Max plan.", 403);
  }

  // Load the article (RLS scopes this to the owner; null == not found/not owned).
  const { data: summary, error: sumErr } = await supabase
    .from("summaries")
    .select("id, search_id, title, model_used")
    .eq("id", summaryId)
    .maybeSingle();
  if (sumErr) return jsonError("Couldn't load that article.", 500);
  if (!summary) return jsonError("Article not found.", 404);

  const searchId = summary.search_id as string;

  const rl = await checkChatRateLimit(supabase, user.id);
  if (!rl.allowed) {
    return jsonError(
      `You've hit the hourly limit of ${rl.limit} follow-up messages. Try again shortly.`,
      429,
    );
  }

  // Gather article context + conversation history in parallel.
  const [blocksRes, sourcesRes, historyRes] = await Promise.all([
    supabase
      .from("summary_blocks")
      .select("type, content, position")
      .eq("summary_id", summaryId)
      .order("position", { ascending: true }),
    supabase
      .from("sources")
      .select("position, title, domain")
      .eq("summary_id", summaryId)
      .order("position", { ascending: true }),
    supabase
      .from("messages")
      .select("role, content")
      .eq("search_id", searchId)
      .order("created_at", { ascending: true }),
  ]);

  const blocks = (blocksRes.data ?? []) as Array<{
    type: "text" | "heading";
    content: string;
  }>;
  const articleMarkdown = blocksToMarkdown(blocks);
  const sources: ChatSource[] = (sourcesRes.data ?? []).map((s) => ({
    position: s.position as number,
    title: (s.title as string) ?? "",
    domain: (s.domain as string) ?? "",
  }));
  const history: ChatTurn[] = (historyRes.data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  const modelSlugUsed = (summary.model_used as string | null) || FALLBACK_MODEL;
  const reasoningEffort = isThinkingSlug(modelSlugUsed) ? ("low" as const) : undefined;

  // Persist the user's message before streaming so it survives a dropped stream.
  await supabase.from("messages").insert({
    search_id: searchId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let answer = "";
      try {
        for await (const delta of streamChatAnswer({
          model: modelSlugUsed,
          title: (summary.title as string) ?? "",
          articleMarkdown,
          sources,
          history,
          question: message,
          reasoningEffort,
        })) {
          answer += delta;
          send({ type: "delta", text: delta });
        }

        // Persist the assistant reply (best-effort — the client already has it).
        if (answer.trim()) {
          await supabase.from("messages").insert({
            search_id: searchId,
            user_id: user.id,
            role: "assistant",
            content: answer,
          });
        }
        send({ type: "done" });
      } catch (err) {
        console.error("chat route error:", err);
        send({
          type: "error",
          message: "Something went wrong answering that. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
