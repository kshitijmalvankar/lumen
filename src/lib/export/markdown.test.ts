import { describe, it, expect } from "vitest";
import { buildExportMarkdown, exportFilename } from "@/lib/export/markdown";
import type { SourceMeta } from "@/components/search/source-list";

const source = (over: Partial<SourceMeta> = {}): SourceMeta => ({
  position: 1,
  title: "Example",
  url: "https://example.com/a",
  domain: "example.com",
  publishedAt: null,
  credibilityTier: "high",
  ...over,
});

describe("buildExportMarkdown", () => {
  it("emits a title, body, and numbered Sources list", () => {
    const md = buildExportMarkdown({
      title: "My Article",
      bodyMarkdown: "A cited claim [1].",
      sources: [source()],
    });
    expect(md).toContain("# My Article");
    expect(md).toContain("A cited claim [1].");
    expect(md).toContain("## Sources");
    expect(md).toContain("1. [Example](https://example.com/a)");
    expect(md).toContain("High credibility");
  });

  it("includes topic/date metadata when provided", () => {
    const md = buildExportMarkdown({
      title: "T",
      query: "climate policy",
      date: "Jan 1, 2026",
      bodyMarkdown: "Body.",
      sources: [],
    });
    expect(md).toContain("**Topic:** climate policy");
    expect(md).toContain("**Saved:** Jan 1, 2026");
  });

  it("escapes brackets in a source title so the link can't break", () => {
    const md = buildExportMarkdown({
      title: "T",
      bodyMarkdown: "B.",
      sources: [source({ title: "Report [draft]" })],
    });
    expect(md).toContain("[Report \\[draft\\]](https://example.com/a)");
  });

  it("omits the Sources section when there are none", () => {
    const md = buildExportMarkdown({
      title: "T",
      bodyMarkdown: "B.",
      sources: [],
    });
    expect(md).not.toContain("## Sources");
  });
});

describe("exportFilename", () => {
  it("slugifies the title into a .md filename", () => {
    expect(exportFilename("Hello, World! 2026")).toBe("hello-world-2026.md");
  });

  it("falls back when the title has no usable characters", () => {
    expect(exportFilename("!!!")).toBe("article.md");
  });
});
