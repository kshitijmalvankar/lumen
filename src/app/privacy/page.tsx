import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · Lumen",
  description: "How Lumen collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="July 3, 2026">
      <p>
        This Privacy Policy explains what data Lumen (&quot;we&quot;) collects,
        why, and the choices you have. By using Lumen you agree to this policy.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account</strong> — your email address and authentication
          details, managed by our auth provider (Supabase).
        </li>
        <li>
          <strong>Your research</strong> — the topics and links you search, the
          generated articles and sources, your saved library, bookmarks, and the
          topics we infer to organize it (your &quot;interest profile&quot;).
        </li>
        <li>
          <strong>Preferences</strong> — the AI model you choose per search and
          your personalization setting.
        </li>
        <li>
          <strong>Billing</strong> — if you subscribe, payments are processed by
          Stripe. We store only your plan, subscription status, and Stripe
          customer/subscription identifiers. <strong>We never see or store your
          card details.</strong>
        </li>
        <li>
          <strong>Essential cookies</strong> — a session cookie to keep you
          signed in. See our <Link href="/cookies">Cookie Notice</Link>.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To provide and improve the service: run your searches, build and organize
        your library, personalize your experience (when enabled), operate
        subscriptions, and keep the service secure and reliable. We do not sell
        your personal data.
      </p>

      <h2>Third parties we share with</h2>
      <p>
        We share the minimum necessary with providers that operate the service on
        our behalf: <strong>Supabase</strong> (database and auth),{" "}
        <strong>OpenRouter</strong> and the underlying model providers (to
        generate articles and answers from your queries and sources),{" "}
        <strong>Stripe</strong> (payments), <strong>Upstash</strong> (caching and
        rate limiting), and <strong>Vercel</strong> (hosting). Each processes data
        under its own terms.
      </p>

      <h2>Public sharing</h2>
      <p>
        If you create a share link for an article, anyone with that link can read
        it without an account. You can stop sharing at any time from the article,
        which disables the link. Do not share articles that contain information
        you consider private.
      </p>

      <h2>Retention</h2>
      <p>
        We keep your data while your account is active. When you delete your
        account, your data is removed promptly (see below).
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (e.g. GDPR/CCPA), you may have rights to
        access, correct, export, or delete your data. You can delete your account
        and all associated data at any time from{" "}
        <Link href="/app/settings">Settings</Link>. For other requests, contact us
        at <strong>privacy@lumen.example</strong>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <strong>privacy@lumen.example</strong>.
      </p>
    </LegalPage>
  );
}
