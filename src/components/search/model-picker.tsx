"use client";

import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickableModels, type ModelId } from "@/lib/ai/model-catalog";
import type { Tier } from "@/lib/billing/entitlements";

interface ModelPickerProps {
  tier: Tier;
  value: ModelId;
  onChange: (id: ModelId) => void;
  disabled?: boolean;
}

/**
 * Lets Pro/Max users pick the article model. Free users see their single model
 * plus an upsell to unlock the rest. The choice is always re-validated
 * server-side, so this is purely a convenience control.
 */
export function ModelPicker({ tier, value, onChange, disabled }: ModelPickerProps) {
  const models = pickableModels(tier);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Model
      </span>

      {models.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            title={`${m.provider} · ${m.hint}`}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50",
              active
                ? "border-brand/40 bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {active && <Check className="h-3.5 w-3.5" />}
            {m.label}
          </button>
        );
      })}

      {tier === "free" && (
        <Link
          href="/app/upgrade"
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Lock className="h-3 w-3" />
          GPT-5, Gemini &amp; Opus with Pro
        </Link>
      )}
    </div>
  );
}
