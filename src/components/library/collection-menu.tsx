"use client";

import * as React from "react";
import Link from "next/link";
import { FolderPlus, FolderCheck, Check, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCollectionAction,
  setArticleCollection,
} from "@/app/app/library/actions";
import type { CollectionWithCount } from "@/lib/library/collections";
import { cn } from "@/lib/utils";

/**
 * Reader control to file an article into one or more collections, or create a
 * new one inline. Optimistic; membership keys on the article's searchId.
 */
export function CollectionMenu({
  searchId,
  collections,
  initialMemberIds,
  cap,
}: {
  searchId: string;
  collections: CollectionWithCount[];
  initialMemberIds: string[];
  /** Max collections for this tier (Infinity for paid). */
  cap: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [cols, setCols] = React.useState(collections);
  const [members, setMembers] = React.useState<Set<string>>(
    () => new Set(initialMemberIds),
  );
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const atCap = Number.isFinite(cap) && cols.length >= cap;

  async function toggle(id: string) {
    const isMember = members.has(id);
    const prev = members;
    const next = new Set(members);
    if (isMember) next.delete(id);
    else next.add(id);
    setMembers(next); // optimistic
    try {
      await setArticleCollection(searchId, id, !isMember);
    } catch {
      setMembers(new Set(prev)); // revert
      toast.error("Couldn't update the collection.");
    }
  }

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await createCollectionAction(name);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const c = res.collection;
      setCols((prev) =>
        prev.some((x) => x.id === c.id)
          ? prev
          : [...prev, { ...c, count: 0 }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      setNewName("");
      setMembers((prev) => new Set(prev).add(c.id));
      try {
        await setArticleCollection(searchId, c.id, true);
        toast.success(`Added to “${c.name}”`);
      } catch {
        toast.error("Created, but couldn't add this article.");
      }
    } finally {
      setBusy(false);
    }
  }

  const count = members.size;
  const Icon = count > 0 ? FolderCheck : FolderPlus;

  return (
    <div className="relative">
      <Button
        type="button"
        variant={count > 0 ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add to a collection"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" />
        <span>{count > 0 ? `In ${count}` : "Collect"}</span>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-2 w-72 max-w-[92vw] rounded-xl border bg-popover p-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="px-1 text-sm font-medium">Collections</p>

            {cols.length > 0 ? (
              <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                {cols.map((c) => {
                  const member = members.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            member
                              ? "border-brand bg-brand text-brand-foreground"
                              : "border-border",
                          )}
                        >
                          {member && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 px-1 text-xs text-muted-foreground">
                No collections yet — create one below.
              </p>
            )}

            <div className="mt-3 border-t pt-3">
              {atCap ? (
                <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  Free plan reached its {cap}-collection limit.{" "}
                  <Link
                    href="/app/upgrade"
                    className="font-medium text-brand hover:underline"
                  >
                    Upgrade
                  </Link>{" "}
                  for unlimited.
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        create();
                      }
                    }}
                    placeholder="New collection…"
                    className="h-8 text-sm"
                    maxLength={60}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    onClick={create}
                    disabled={busy || !newName.trim()}
                    aria-label="Create collection"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
