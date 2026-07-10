import { describe, it, expect, afterEach } from "vitest";
import { searchDepth } from "@/lib/billing/entitlements";

const FLAG = "LUMEN_EXTENDED_COMPUTE";

afterEach(() => {
  delete process.env[FLAG];
});

describe("searchDepth", () => {
  it("returns the Hobby-safe flat baseline when extended compute is off", () => {
    delete process.env[FLAG];
    expect(searchDepth("free").sources).toBe(7);
    expect(searchDepth("pro").sources).toBe(7);
    expect(searchDepth("max").sources).toBe(7);
    expect(searchDepth("max").contentBudget).toBe(28000);
  });

  it("returns deeper per-tier sourcing + a bigger budget when extended", () => {
    process.env[FLAG] = "1";
    expect(searchDepth("free").sources).toBe(8);
    expect(searchDepth("pro").sources).toBe(14);
    expect(searchDepth("max").sources).toBe(20);
    expect(searchDepth("max").contentBudget).toBe(52000);
  });
});
