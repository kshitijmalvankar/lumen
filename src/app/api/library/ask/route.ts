import { z } from "zod";
import { isSupabaseConfigured, isEmbeddingsConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/billing/entitlements";
import { checkLibraryRateLimit } from "@/lib/cache/redis";
import { embedQuery } from "@/lib/ai/embeddings";
import { retrieveLibrary } from "@/lib/library/ask";
import { buildLibraryContext, type LibraryContext } from "@/lib/library/ask-core";
import { streamLibraryAnswer } from "@/lib/ai/chat";
import { modelSlug } from "@/lib/ai/model-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ message: z.string().trim().min(1).max(2000) });

// Cross-library synthesis uses Sonnet — capable but cheaper than Opus.
const ANSWER_MODEL = modelSlug("claude-sonnet");

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Ask a question to continue.", 400);
  const { message } = parsed.data;

  if (!isSupabaseConfigured() || !isEmbeddingsConfigured()) {
    return jsonError("Library Intelligence isn't configured.", 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in.", 401);

  const tier = await getUserTier(supabase, user.id);
  if (tier === "free") {
    return jsonError("Ask your library is available on Pro and Max.", 403);
  }

  const rl = await checkLibraryRateLimit(supabase, user.id);
  if (!rl.allowed) {
    return jsonError(
      `You've hit the hourly limit of ${rl.limit} library questions. Try again shortly.`,
      429,
    );
  }

  // Embed the question, then retrieve the most relevant passages across the
  // user's saved articles (fast; fits comfortably in one invocation).
  let context: LibraryContext;
  try {
    const queryVec = await embedQuery(message);
    if (!queryVec) return jsonError("Couldn't process that question.", 500);
    const articles = await retrieveLibrary(supabase, queryVec);
    context = buildLibraryContext(articles);
  } catch (err) {
    console.error("library ask retrieval error:", err);
    return jsonError("Couldn't search your library right now.", 500);
  }

  // Persist the question up front (also feeds the DB rate-limit fallback).
  await supabase.from("library_messages").insert({
    user_id: user.id,
    thread_id: user.id, // one implicit default thread per user for the MVP
    role: "user",
    content: message,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // Send the [A#] → article map first so the client can linkify citations.
      send({ type: "articles", articles: context.articles });

      if (context.articles.length === 0) {
        send({
          type: "delta",
          text: "I couldn't find anything in your library about that yet. Try saving a few more articles on the topic, or rephrase the question.",
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      let answer = "";
      try {
        for await (const delta of streamLibraryAnswer({
          model: ANSWER_MODEL,
          contextText: context.contextText,
          question: message,
        })) {
          answer += delta;
          send({ type: "delta", text: delta });
        }
        if (answer.trim()) {
          await supabase.from("library_messages").insert({
            user_id: user.id,
            thread_id: user.id,
            role: "assistant",
            content: answer,
          });
        }
        send({ type: "done" });
      } catch (err) {
        console.error("library ask stream error:", err);
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
