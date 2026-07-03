import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · Lumen",
  description: "The terms that govern your use of Lumen.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="July 3, 2026">
      <p>
        These Terms govern your use of Lumen. By creating an account or using the
        service, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Lumen assembles articles and answers from web sources using AI. Content is
        generated automatically and <strong>may be inaccurate, incomplete, or out
        of date</strong>. It is for general information only and is{" "}
        <strong>not professional advice</strong> (medical, legal, financial, or
        otherwise). Always verify important claims against the cited sources.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for activity under your account and for keeping your
        credentials secure. You must be able to form a binding contract to use
        Lumen.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use Lumen for unlawful, harmful, or abusive purposes.</li>
        <li>
          Do not attempt to disrupt, overload, scrape, or reverse-engineer the
          service, or circumvent usage limits.
        </li>
        <li>
          You are responsible for anything you share publicly via share links.
        </li>
      </ul>

      <h2>Subscriptions and billing</h2>
      <p>
        Paid plans (Pro and Max) are billed through Stripe on a recurring basis
        until cancelled. Plan changes are prorated. You can cancel at any time
        from <Link href="/app/settings">Settings</Link>; access continues until
        the end of the current billing period. Fees are non-refundable except
        where required by law.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &quot;as is&quot; without warranties of any kind.
        To the fullest extent permitted by law, Lumen is not liable for any
        indirect, incidental, or consequential damages, or for decisions made in
        reliance on generated content.
      </p>

      <h2>Termination</h2>
      <p>
        You may delete your account at any time from Settings. We may suspend or
        terminate access for violations of these Terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms; material changes will be reflected by the
        &quot;last updated&quot; date. Continued use means you accept the changes.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <strong>support@lumen.example</strong>.
      </p>
    </LegalPage>
  );
}
