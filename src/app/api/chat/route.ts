import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkChatRateLimit } from "@/lib/cache/redis";
import { getUserTier } from "@/lib/billing/entitlements";
import { blocksToMarkdown } from "@/lib/library/queries";
import {
  streamChatAnswer,
  classifyFollowup,
  type ChatSource,
  type ChatTurn,
} from "@/lib/ai/chat";
import { gatherSearchSources } from "@/lib/search/pipeline";
import { modelSlug, isThinkingSlug } from "@/lib/ai/model-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opus replies can run long; 300s needs Vercel Pro (Hobby clamps to 60s).
export const maxDuration = 300;

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
      .select("position, title, url, domain, content, snippet")
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
    content: (((s.content as string | null) || (s.snippet as string | null)) ?? "").slice(
      0,
      1600,
    ),
  }));
  const existingUrls = new Set(
    (sourcesRes.data ?? [])
      .map((s) => s.url as string | undefined)
      .filter((u): u is string => Boolean(u)),
  );
  let maxPosition = sources.reduce((m, s) => Math.max(m, s.position), 0);
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

      // If the article + its sources don't cover the question, search the web and
      // APPEND the new sources to the article (deduped, renumbered) so this and
      // future chats can cite them. Best-effort — never blocks the answer.
      let sourcesAdded = false;
      try {
        const cls = await classifyFollowup({
          question: message,
          title: (summary.title as string) ?? "",
          sources: sources.map((s) => ({ title: s.title, domain: s.domain })),
        });
        if (cls.search && cls.query) {
          send({ type: "status", message: "Searching the web for more…" });
          const fresh = await gatherSearchSources(cls.query, { count: 6 });
          const newOnes = fresh.filter(
            (f) => f.url && !existingUrls.has(f.url),
          );
          if (newOnes.length > 0) {
            const rows = newOnes.map((f, i) => ({
              summary_id: summaryId,
              user_id: user.id,
              position: maxPosition + 1 + i,
              url: f.url,
              title: f.title,
              domain: f.domain,
              published_at: f.publishedAt,
              credibility_tier: f.credibilityTier,
              political_lean: f.politicalLean,
              snippet: f.snippet,
              content: f.content ?? null,
            }));
            const { error: insErr } = await supabase.from("sources").insert(rows);
            if (!insErr) {
              newOnes.forEach((f, i) =>
                sources.push({
                  position: maxPosition + 1 + i,
                  title: f.title,
                  domain: f.domain,
                  content: (f.content ?? "").slice(0, 1600),
                }),
              );
              maxPosition += newOnes.length;
              sourcesAdded = true;
            }
          }
        }
      } catch (err) {
        console.error("chat web-search step failed:", err);
      }

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
        // Tell the client to refresh so newly-appended sources show up.
        if (sourcesAdded) send({ type: "sources_added" });
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
