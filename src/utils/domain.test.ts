import { describe, expect, it } from "vitest";
import { normalizeDomain } from "./domain";

describe("normalizeDomain (FR-12, SRS 9.1)", () => {
  it.each([
    ["youtube.com", "youtube.com"],
    ["  YouTube.COM  ", "youtube.com"],
    ["https://www.youtube.com/watch?v=1", "youtube.com"],
    ["http://reddit.com", "reddit.com"],
    ["*.reddit.com", "reddit.com"],
    ["www.facebook.com", "facebook.com"],
    ["example.com:8080/path", "example.com"],
    ["sub.domain.example.co.uk", "sub.domain.example.co.uk"],
    ["x.com", "x.com"],
  ])("accepts %s as %s", (input, expected) => {
    const r = normalizeDomain(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.domain).toBe(expected);
  });

  it("tells the user when a path was dropped", () => {
    const r = normalizeDomain("https://example.com/some/page");
    expect(r.ok && r.droppedPath).toBe(true);
    const plain = normalizeDomain("example.com");
    expect(plain.ok && plain.droppedPath).toBe(false);
  });

  it.each([
    "", "   ", "not a domain", "localhost", "http://localhost:3000", "192.168.1.1", "10.0.0.1:80", "[::1]",
    "javascript:alert(1)", "chrome://settings", "ftp://example.com", "-bad.com", "bad-.com", "a..com", ".com", "example", "exa mple.com",
    `${"a".repeat(64)}.com`, "under_score.com",
  ])("rejects %j", (input) => {
    expect(normalizeDomain(input).ok).toBe(false);
  });

  it("gives a clear message for IP addresses", () => {
    const r = normalizeDomain("192.168.1.1");
    expect(!r.ok && r.error).toMatch(/IP addresses/);
  });
});
