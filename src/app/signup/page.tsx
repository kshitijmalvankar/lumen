import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string }>;
}) {
  const { error, check } = await searchParams;
  const message = check
    ? "Check your email to confirm your account, then sign in."
    : undefined;

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]">
        <div className="aurora-blob animate-float-slow left-1/2 top-8 h-72 w-72 -translate-x-1/2 bg-brand/40" />
        <div className="aurora-blob animate-float-slower right-[18%] top-20 h-60 w-60 bg-violet-400/30" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Lumen
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-500">
          <AuthForm mode="signup" error={error} message={message} />
        </div>
      </main>
    </div>
  );
}
