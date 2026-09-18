import { describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { claimAnonymousData, type ClaimDeps } from "./claim";
import type { Profile } from "./repository";

const USER: Actor = { kind: "user", userId: "user_1" };
const ANON = { kind: "anonymous" as const, tokenHash: "hash_abc" };

const profile = (id: string) => ({ id }) as Profile;

function deps(overrides: Partial<ClaimDeps> = {}) {
  return {
    getAnonActor: vi.fn(async () => ANON),
    claimProfiles: vi.fn(async () => [profile("p1")]),
    rotateToken: vi.fn(async () => undefined),
    ...overrides,
  } satisfies ClaimDeps;
}

describe("claimAnonymousData", () => {
  it("claims the profile behind the visitor's token", async () => {
    const d = deps();

    expect(await claimAnonymousData(USER, d)).toEqual({ claimed: 1 });
    expect(d.claimProfiles).toHaveBeenCalledWith(USER, "hash_abc");
  });

  it("rotates the token once the data is theirs", async () => {
    const d = deps();
    await claimAnonymousData(USER, d);

    expect(d.rotateToken).toHaveBeenCalledOnce();
  });

  it("leaves the token alone when there was nothing to claim", async () => {
    const d = deps({ claimProfiles: vi.fn(async () => []) });

    expect(await claimAnonymousData(USER, d)).toEqual({ claimed: 0 });
    // Rotating here would discard a token that may still be the only route back to
    // data the visitor has not been given yet.
    expect(d.rotateToken).not.toHaveBeenCalled();
  });

  it("does nothing for a visitor who has never been anonymous", async () => {
    const d = deps({ getAnonActor: vi.fn(async () => null) });

    expect(await claimAnonymousData(USER, d)).toEqual({ claimed: 0 });
    expect(d.claimProfiles).not.toHaveBeenCalled();
    expect(d.rotateToken).not.toHaveBeenCalled();
  });

  it("is a no-op for an anonymous visitor, who has nothing to claim into", async () => {
    const d = deps();

    expect(await claimAnonymousData(ANON, d)).toEqual({ claimed: 0 });
    expect(d.getAnonActor).not.toHaveBeenCalled();
  });

  it.each([
    ["member", { kind: "member", userId: "u", orgId: "o", role: "owner" } as Actor],
    ["admin", { kind: "admin", userId: "u" } as Actor],
  ])("is a no-op for a %s, who works from client records instead", async (_name, actor) => {
    const d = deps();

    expect(await claimAnonymousData(actor, d)).toEqual({ claimed: 0 });
    expect(d.claimProfiles).not.toHaveBeenCalled();
  });

  it("claims every profile the token owned, not just the first", async () => {
    const d = deps({ claimProfiles: vi.fn(async () => [profile("p1"), profile("p2")]) });

    expect(await claimAnonymousData(USER, d)).toEqual({ claimed: 2 });
  });

  it("does not swallow a failed claim", async () => {
    const d = deps({
      claimProfiles: vi.fn(async () => {
        throw new Error("database is down");
      }),
    });

    await expect(claimAnonymousData(USER, d)).rejects.toThrow("database is down");
    expect(d.rotateToken).not.toHaveBeenCalled();
  });
});
