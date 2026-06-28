import Link from "next/link";

import { login, signup, signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

type AuthFormProps = {
  mode: "login" | "signup";
  error?: string;
  message?: string;
};

export function AuthForm({ mode, error, message }: AuthFormProps) {
  const isLogin = mode === "login";
  const action = isLogin ? login : signup;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Sign in to your Lumen account"
            : "Start building your knowledge library"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}

        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            <GoogleIcon />
            Continue with Google
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          <SubmitButton className="w-full">
            {isLogin ? "Sign in" : "Sign up"}
          </SubmitButton>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        {isLogin ? (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
