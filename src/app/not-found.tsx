import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass className="h-5 w-5" />
      </span>
      <p className="mt-4 font-serif text-5xl font-semibold tracking-tight">404</p>
      <h1 className="mt-2 font-serif text-xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page doesn&apos;t exist, or the link may have expired.
      </p>
      <Link href="/" className={cn(buttonVariants(), "mt-6")}>
        Back to Lumen
      </Link>
    </div>
  );
}
