"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/app/app/settings/actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const armed = text.trim().toLowerCase() === "delete";

  function onDelete() {
    if (!armed) return;
    startTransition(async () => {
      try {
        await deleteAccount(); // redirects to "/" on success
      } catch {
        toast.error("Couldn't delete your account. Please try again.");
      }
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This permanently deletes your account, your library and articles, and
        cancels any subscription. This <strong>cannot be undone</strong>. Type{" "}
        <span className="font-medium text-foreground">delete</span> to confirm.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="delete"
          aria-label="Type delete to confirm"
          className="sm:max-w-40"
          disabled={pending}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={!armed || pending}
          >
            {pending ? "Deleting…" : "Permanently delete"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(false);
              setText("");
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
