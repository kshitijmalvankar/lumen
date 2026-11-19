import { describe, it, expect } from "vitest";
import { splitSections } from "./sections";

describe("splitSections", () => {
  it("separates an intro from its h2 sections", () => {
    const md = [
      "Intro paragraph one.",
      "",
      "## First",
      "First body.",
      "",
      "## Second",
      "Second body.",
    ].join("\n");

    const { intro, sections } = splitSections(md);
    expect(intro).toBe("Intro paragraph one.");
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("First");
    expect(sections[0].body).toContain("First body.");
    expect(sections[1].title).toBe("Second");
  });

  it("returns no sections for a body with none (single-paragraph article)", () => {
    const { intro, sections } = splitSections("Just one paragraph, no headings.");
    expect(sections).toHaveLength(0);
    expect(intro).toBe("Just one paragraph, no headings.");
  });

  it("keeps '###' subheadings inside their parent section", () => {
    const md = ["## Parent", "Lead.", "### Child", "Detail."].join("\n");
    const { sections } = splitSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Parent");
    expect(sections[0].body).toContain("### Child");
  });

  it("handles a body that opens directly with a heading (no intro)", () => {
    const { intro, sections } = splitSections("## Only\nBody.");
    expect(intro).toBe("");
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Only");
  });
});
