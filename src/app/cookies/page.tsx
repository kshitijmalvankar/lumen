import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cookie Notice · Lumen",
  description: "How Lumen uses cookies.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Notice" lastUpdated="July 3, 2026">
      <p>
        Lumen uses a small number of cookies that are strictly necessary to
        operate the service. We do not use advertising or cross-site tracking
        cookies.
      </p>

      <h2>Cookies we use</h2>
      <ul>
        <li>
          <strong>Authentication / session</strong> — set by our auth provider
          (Supabase) to keep you signed in and secure your session. Without these
          you cannot stay logged in.
        </li>
        <li>
          <strong>Preferences</strong> — a local setting such as your light/dark
          theme, stored to remember your choice.
        </li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings, but essential
        cookies are required to sign in and use Lumen. Blocking them will prevent
        the app from working.
      </p>

      <h2>More information</h2>
      <p>
        See our <Link href="/privacy">Privacy Policy</Link> for how we handle your
        data. Questions: <strong>privacy@lumen.example</strong>.
      </p>
    </LegalPage>
  );
}
