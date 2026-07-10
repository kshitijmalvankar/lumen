import { describe, it, expect } from "vitest";
import { buildBibTeX, buildRIS } from "@/lib/export/citations";
import type { SourceMeta } from "@/components/search/source-list";

const src = (o: Partial<SourceMeta> = {}): SourceMeta => ({
  position: 1,
  title: "Tides Explained",
  url: "https://nasa.gov/tides",
  domain: "nasa.gov",
  publishedAt: "2024-03-01T00:00:00Z",
  credibilityTier: "high",
  ...o,
});

describe("buildBibTeX", () => {
  it("emits a @misc entry per source with key, title, url, year", () => {
    const bib = buildBibTeX([
      src(),
      src({
        position: 2,
        domain: "www.example.com",
        url: "https://example.com/a",
        title: "A",
      }),
    ]);
    expect(bib).toContain("@misc{nasagov1");
    expect(bib).toContain("title = {Tides Explained}");
    expect(bib).toContain("\\url{https://nasa.gov/tides}");
    expect(bib).toContain("year = {2024}");
    // "www." is stripped from the citation key.
    expect(bib).toContain("@misc{examplecom2");
  });

  it("omits year when there's no valid published date", () => {
    const bib = buildBibTeX([src({ publishedAt: null })]);
    expect(bib).not.toContain("year =");
  });
});

describe("buildRIS", () => {
  it("emits a TY/TI/UR/ER record per source", () => {
    const ris = buildRIS([src()]);
    expect(ris).toContain("TY  - ELEC");
    expect(ris).toContain("TI  - Tides Explained");
    expect(ris).toContain("UR  - https://nasa.gov/tides");
    expect(ris).toContain("PY  - 2024");
    expect(ris.trimEnd().endsWith("ER  -")).toBe(true);
  });
});
