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

/**
 * Sanitize a post-auth `next` target to a same-origin relative path. Anything
 * that could escape our origin — absolute URLs, protocol-relative `//host`,
 * backslash tricks (`/\host`, browsers treat `\` as `/`), or a value that would
 * be concatenated onto the origin as userinfo (`@host`) — is rejected in favor
 * of the default. Callers redirect to `${origin}${safeNext(raw)}`.
 */
export function safeNext(
  next: string | null | undefined,
  fallback = "/app",
): string {
  if (!next) return fallback;
  // Must be a rooted path, and not one that re-introduces a host.
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
