import { describe, it, expect } from "vitest";
import { buildDigestHtml } from "@/lib/email/digest-html";

describe("buildDigestHtml", () => {
  it("deep-links watches + interests to /app?q= and greets by first name", () => {
    const html = buildDigestHtml({
      siteUrl: "https://lumenlm.vercel.app",
      name: "Ada Lovelace",
      watches: ["GLP-1 drugs"],
      interests: ["AI policy"],
    });
    expect(html).toContain("Hi Ada,");
    expect(html).toContain(
      "https://lumenlm.vercel.app/app?q=GLP-1%20drugs",
    );
    expect(html).toContain("https://lumenlm.vercel.app/app?q=AI%20policy");
    expect(html).toContain("Manage in Settings");
  });

  it("escapes HTML and omits empty sections", () => {
    const html = buildDigestHtml({
      siteUrl: "https://x.test",
      name: null,
      watches: ['<script>"x"'],
      interests: [],
    });
    expect(html).toContain("Hi,");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("Because you've been reading");
  });
});
