import Link from "next/link";
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
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Lumen
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <AuthForm mode="signup" error={error} message={message} />
      </main>
    </div>
  );
}
