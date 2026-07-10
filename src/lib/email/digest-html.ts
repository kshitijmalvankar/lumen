// Pure digest-email HTML builder — no server-only imports, so it's unit-testable.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkList(siteUrl: string, items: string[]): string {
  return items
    .map((q) => {
      const href = `${siteUrl}/app?q=${encodeURIComponent(q)}`;
      return `<li style="margin:6px 0;"><a href="${href}" style="color:#4f46e5;text-decoration:none;">${esc(q)}</a></li>`;
    })
    .join("");
}

/**
 * Compose the weekly digest HTML from a user's watched topics + top interests.
 * Deep-links each item to `/app?q=…`, which auto-runs the research on arrival.
 */
export function buildDigestHtml(args: {
  siteUrl: string;
  name?: string | null;
  watches: string[];
  interests: string[];
}): string {
  const { siteUrl, name, watches, interests } = args;
  const hi = name ? `Hi ${esc(name.split(" ")[0])},` : "Hi,";

  const watchSection = watches.length
    ? `<h2 style="font-size:16px;margin:24px 0 8px;">Topics you're tracking</h2>
       <ul style="padding-left:18px;margin:0;">${linkList(siteUrl, watches)}</ul>`
    : "";

  const interestSection = interests.length
    ? `<h2 style="font-size:16px;margin:24px 0 8px;">Because you've been reading</h2>
       <ul style="padding-left:18px;margin:0;">${linkList(siteUrl, interests)}</ul>`
    : "";

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;">
  <p style="font-size:20px;font-weight:600;margin:0 0 4px;">Lumen — your weekly digest</p>
  <p style="color:#555;margin:0 0 8px;">${hi} here's what's worth a fresh look. Tap any topic to research the latest.</p>
  ${watchSection}
  ${interestSection}
  <p style="margin:28px 0 0;font-size:12px;color:#888;">
    You're getting this because weekly digests are on.
    <a href="${siteUrl}/app/settings" style="color:#888;">Manage in Settings</a>.
  </p>
</div>`;
}
