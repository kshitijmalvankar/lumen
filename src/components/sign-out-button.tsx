"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={signOut}
      disabled={loading}
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
