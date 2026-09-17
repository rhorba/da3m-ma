import { describe, expect, it, vi } from "vitest";
import { hashAnonToken } from "./actor";
import { resolveActor, type ResolveActorDeps } from "./resolve-actor";

const ORG_ID = "00000000-0000-4000-8000-0000000000aa";

function deps(overrides: Partial<ResolveActorDeps> = {}): ResolveActorDeps {
  return {
    getSession: async () => ({ userId: null, clerkOrgId: null }),
    getAnonToken: async () => null,
    findMembership: async () => null,
    ...overrides,
  };
}

describe("resolveActor", () => {
  it("returns null with no session and no anonymous cookie", async () => {
    expect(await resolveActor(deps())).toBeNull();
  });

  it("returns an anonymous actor carrying only the token hash", async () => {
    const actor = await resolveActor(deps({ getAnonToken: async () => "raw-token" }));
    expect(actor).toEqual({ kind: "anonymous", tokenHash: hashAnonToken("raw-token") });
  });

  it("returns a user actor when signed in without an active organisation", async () => {
    const findMembership = vi.fn();
    const actor = await resolveActor(
      deps({
        getSession: async () => ({ userId: "user_1", clerkOrgId: null }),
        getAnonToken: async () => "ignored-when-signed-in",
        findMembership,
      }),
    );
    expect(actor).toEqual({ kind: "user", userId: "user_1" });
    expect(findMembership).not.toHaveBeenCalled();
  });

  it("returns a member actor with the role recorded in our database", async () => {
    const actor = await resolveActor(
      deps({
        getSession: async () => ({ userId: "user_1", clerkOrgId: "org_abc" }),
        findMembership: async (clerkOrgId, clerkUserId) =>
          clerkOrgId === "org_abc" && clerkUserId === "user_1"
            ? { orgId: ORG_ID, role: "viewer" }
            : null,
      }),
    );
    expect(actor).toEqual({ kind: "member", userId: "user_1", orgId: ORG_ID, role: "viewer" });
  });

  it("does not grant firm access from a stale session org claim with no membership row", async () => {
    const actor = await resolveActor(
      deps({ getSession: async () => ({ userId: "user_1", clerkOrgId: "org_removed" }) }),
    );
    expect(actor).toEqual({ kind: "user", userId: "user_1" });
  });
});
