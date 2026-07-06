import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkRatingsRateLimit } from "@/lib/cache/redis";
import {
  rateSourcesFast,
  classifyDomains,
  upsertRatings,
  findUnclassifiedDomains,
  maxTier,
} from "@/lib/search/ratings";
import type { CredibilityTier, PoliticalLean } from "@/lib/search/credibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Its own fresh budget — this is the "stacked" request that keeps the LLM pass
// off the search route's 60s path. (300s effective only on Vercel Pro.)
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

const bodySchema = z.object({ summaryId: z.string().uuid() });

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return jsonError("Not configured.", 503);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Missing article id.", 400);
  const { summaryId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in.", 401);

  const rl = await checkRatingsRateLimit(user.id);
  if (!rl.allowed) return jsonError("Too many requests. Try again shortly.", 429);

  // Load this article's sources (RLS scopes to the owner).
  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, domain, political_lean, credibility_tier")
    .eq("summary_id", summaryId);
  if (error) return jsonError("Couldn't load sources.", 500);
  if (!sources || sources.length === 0) {
    return Response.json({ status: "ok", updated: 0 });
  }

  // Domains on rows still lacking a lean in this article's snapshot.
  const unratedDomains = [
    ...new Set(
      sources
        .filter((s) => (s.political_lean as PoliticalLean) === "unknown")
        .map((s) => (s.domain as string) ?? "")
        .filter(Boolean),
    ),
  ];
  if (unratedDomains.length === 0) return Response.json({ status: "ok", updated: 0 });

  // Only classify domains not already in the ratings table (a domain the LLM
  // judged "unknown" stays present, so it's never re-classified → no loop).
  const toClassify = await findUnclassifiedDomains(unratedDomains);
  if (toClassify.length > 0) {
    try {
      await upsertRatings(await classifyDomains(toClassify));
    } catch (err) {
      console.error("ratings classify error:", err); // non-fatal
    }
  }

  // Resolve every unrated domain from the (now-updated) table + floor.
  const resolved = await rateSourcesFast(unratedDomains);

  // Update this article's source rows that gained a rating.
  let updated = 0;
  await Promise.all(
    sources.map(async (s) => {
      if ((s.political_lean as PoliticalLean) !== "unknown") return;
      const r = resolved.get((s.domain as string) ?? "");
      if (!r) return;
      const nextCred = maxTier(
        s.credibility_tier as CredibilityTier,
        r.credibilityTier,
      );
      if (
        r.politicalLean === "unknown" &&
        nextCred === (s.credibility_tier as CredibilityTier)
      ) {
        return; // genuinely nothing to change
      }
      const { error: upErr } = await supabase
        .from("sources")
        .update({ political_lean: r.politicalLean, credibility_tier: nextCred })
        .eq("id", s.id as string);
      if (!upErr) updated += 1;
    }),
  );

  return Response.json({ status: "ok", updated });
}
