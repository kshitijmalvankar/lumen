/**
 * True only for well-formed http(s) URLs. Source URLs come from web-search /
 * LLM output, so we gate any `href` through this to avoid `javascript:` /
 * `data:` click-to-execute vectors before rendering a raw <a>.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
