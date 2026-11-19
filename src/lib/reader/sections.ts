export interface ArticleSection {
  title: string;
  body: string;
}

/**
 * Split an article body into the intro (anything before the first "## ") and
 * its h2 sections. Stored bodies delimit headings as their own "## …" lines
 * (see blocksToMarkdown), so a line scan is reliable; "###" and deeper stay
 * inside their section. Pure so the reader's collapsible view can be tested.
 */
export function splitSections(markdown: string): {
  intro: string;
  sections: ArticleSection[];
} {
  const intro: string[] = [];
  const sections: ArticleSection[] = [];
  let current: ArticleSection | null = null;

  for (const line of markdown.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push(current);

  return { intro: intro.join("\n").trim(), sections };
}
