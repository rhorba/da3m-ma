import { describe, expect, it } from "vitest";
import {
  canWriteCabinet,
  generateAnonToken,
  hashAnonToken,
  mapClerkRole,
  type Actor,
} from "./actor";

describe("mapClerkRole", () => {
  it.each([
    ["org:admin", "owner"],
    ["org:owner", "owner"],
    ["org:member", "consultant"],
    ["org:consultant", "consultant"],
    ["org:viewer", "viewer"],
    ["org:something_new", "viewer"],
    ["", "viewer"],
  ])("maps %s to %s", (clerkRole, expected) => {
    expect(mapClerkRole(clerkRole)).toBe(expected);
  });
});

describe("anonymous tokens", () => {
  it("generates distinct 256-bit url-safe tokens", () => {
    const a = generateAnonToken();
    const b = generateAnonToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes deterministically and never returns the raw token", () => {
    const token = generateAnonToken();
    expect(hashAnonToken(token)).toBe(hashAnonToken(token));
    expect(hashAnonToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAnonToken(token)).not.toContain(token);
  });
});

describe("canWriteCabinet", () => {
  const member = (role: "owner" | "consultant" | "viewer"): Actor => ({
    kind: "member",
    userId: "user_1",
    orgId: "00000000-0000-4000-8000-000000000001",
    role,
  });

  it("allows owners and consultants", () => {
    expect(canWriteCabinet(member("owner"))).toBe(true);
    expect(canWriteCabinet(member("consultant"))).toBe(true);
  });

  it("refuses viewers, users, anonymous visitors and platform admins", () => {
    expect(canWriteCabinet(member("viewer"))).toBe(false);
    expect(canWriteCabinet({ kind: "user", userId: "user_1" })).toBe(false);
    expect(canWriteCabinet({ kind: "anonymous", tokenHash: "x" })).toBe(false);
    expect(canWriteCabinet({ kind: "admin", userId: "user_1" })).toBe(false);
  });
});
