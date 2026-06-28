import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { listLibrary } from "@/lib/library/queries";
import { LibraryView } from "@/components/library/library-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mt-20 text-center text-muted-foreground">
        <p>The app isn&apos;t fully configured yet.</p>
        <Link href="/app" className={cn(buttonVariants({ variant: "link" }))}>
          Back to search
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const items = await listLibrary(supabase);

  return <LibraryView items={items} />;
}
