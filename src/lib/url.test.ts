import { describe, it, expect } from "vitest";
import { safeNext, isSafeHttpUrl } from "@/lib/url";

describe("safeNext", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNext("/app/settings")).toBe("/app/settings");
    expect(safeNext("/library")).toBe("/library");
  });

  it("rejects open-redirect vectors", () => {
    expect(safeNext("@evil.com")).toBe("/app"); // becomes https://host@evil.com
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("")).toBe("/app");
    expect(safeNext(null)).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });

  it("honors a custom fallback", () => {
    expect(safeNext(null, "/login")).toBe("/login");
  });
});

describe("isSafeHttpUrl", () => {
  it("accepts http(s) and rejects other schemes", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});
