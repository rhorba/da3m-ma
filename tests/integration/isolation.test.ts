import { beforeAll, describe, expect, it } from "vitest";
import { AccessDeniedError, createAuthRepository, hashAnonToken, type Actor } from "@/lib/auth";
import { createCabinetRepository, type Client } from "@/lib/cabinet";
import { createProfilesRepository } from "@/lib/profiles";
import { seedFirm, uniqueId, connectTestDatabase } from "./helpers";

// Story 1.4 — tenant isolation. CI-blocking; never waived (test strategy §7).

const db = connectTestDatabase();
const cabinet = createCabinetRepository(db);
const profilesRepo = createProfilesRepository(db);

describe("firm isolation", () => {
  let firmA: Awaited<ReturnType<typeof seedFirm>>;
  let consultantA: Extract<Actor, { kind: "member" }>;
  let viewerA: Extract<Actor, { kind: "member" }>;
  let consultantB: Extract<Actor, { kind: "member" }>;
  let clientA: Client;

  beforeAll(async () => {
    firmA = await seedFirm(db, "Firm A");
    const firmB = await seedFirm(db, "Firm B");
    consultantA = await firmA.member("consultant");
    viewerA = await firmA.member("viewer");
    consultantB = await firmB.member("consultant");
    clientA = await cabinet.createClient(consultantA, {
      displayName: "Atlas Bois SARL",
      contactEmail: "contact@atlasbois.ma",
    });
  });

  it("lets a consultant create and read a client in their own firm", async () => {
    expect(clientA.orgId).toBe(firmA.org.id);
    expect(clientA.createdBy).toBe(consultantA.userId);
    expect(await cabinet.getClient(consultantA, clientA.id)).toMatchObject({ id: clientA.id });
    expect((await cabinet.listClients(consultantA)).map((c) => c.id)).toContain(clientA.id);
  });

  it("lets a viewer read but not write", async () => {
    expect(await cabinet.getClient(viewerA, clientA.id)).toMatchObject({ id: clientA.id });
    await expect(cabinet.createClient(viewerA, { displayName: "Nope" })).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("hides a firm's clients from a consultant in another firm", async () => {
    expect(await cabinet.getClient(consultantB, clientA.id)).toBeNull();
    expect((await cabinet.listClients(consultantB)).map((c) => c.id)).not.toContain(clientA.id);
  });

  it("does not let a platform admin read firm data", async () => {
    const admin: Actor = { kind: "admin", userId: uniqueId("user") };
    expect(await cabinet.getClient(admin, clientA.id)).toBeNull();
    expect(await cabinet.listClients(admin)).toEqual([]);
    await expect(cabinet.createClient(admin, { displayName: "Nope" })).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("does not expose firm clients to signed-in users or anonymous visitors", async () => {
    const user: Actor = { kind: "user", userId: consultantA.userId };
    const anon: Actor = { kind: "anonymous", tokenHash: hashAnonToken("t") };
    for (const actor of [user, anon]) {
      expect(await cabinet.getClient(actor, clientA.id)).toBeNull();
      expect(await cabinet.listClients(actor)).toEqual([]);
    }
  });

  it("treats a malformed id as not found rather than erroring", async () => {
    expect(await cabinet.getClient(consultantA, "not-a-uuid")).toBeNull();
  });

  it("rejects invalid client input", async () => {
    await expect(cabinet.createClient(consultantA, { displayName: "   " })).rejects.toThrow();
    await expect(
      cabinet.createClient(consultantA, { displayName: "X", contactEmail: "not-an-email" }),
    ).rejects.toThrow();
  });

  it("resolves a membership only for actual members of the firm", async () => {
    const auth = createAuthRepository(db);
    expect(await auth.findMembership(firmA.org.clerkOrgId, consultantA.userId)).toEqual({
      orgId: firmA.org.id,
      role: "consultant",
    });
    expect(await auth.findMembership(firmA.org.clerkOrgId, consultantB.userId)).toBeNull();
  });
});

describe("B2C profile ownership", () => {
  const anon = (): Extract<Actor, { kind: "anonymous" }> => ({
    kind: "anonymous",
    tokenHash: hashAnonToken(uniqueId("token")),
  });
  const t1 = anon();
  const t2 = anon();

  it("keeps an anonymous profile private to its token", async () => {
    const profile = await profilesRepo.saveProfile(t1, { region: "fes-meknes" });
    expect(profile.ownerUserId).toBeNull();
    expect(await profilesRepo.getProfile(t1, profile.id)).toMatchObject({ id: profile.id });
    expect(await profilesRepo.getProfile(t2, profile.id)).toBeNull();
  });

  it("keeps one profile per anonymous token and updates it on every save", async () => {
    const visitor = anon();
    const first = await profilesRepo.saveProfile(visitor, { step: 1 });
    const second = await profilesRepo.saveProfile(visitor, { step: 2, region: "souss-massa" });
    expect(second.id).toBe(first.id);
    expect(second.data).toEqual({ step: 2, region: "souss-massa" });
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
  });

  it("keeps a user's profile private to that user", async () => {
    const u1: Actor = { kind: "user", userId: uniqueId("user") };
    const u2: Actor = { kind: "user", userId: uniqueId("user") };
    const profile = await profilesRepo.saveProfile(u1, { region: "casablanca-settat" });
    expect(profile.anonTokenHash).toBeNull();
    expect(await profilesRepo.getProfile(u1, profile.id)).toMatchObject({ id: profile.id });
    expect(await profilesRepo.getProfile(u2, profile.id)).toBeNull();
  });

  it("never exposes B2C profiles to firm members or platform admins", async () => {
    const profile = await profilesRepo.saveProfile(anon(), { region: "oriental" });
    const firm = await seedFirm(db);
    const owner = await firm.member("owner");
    const admin: Actor = { kind: "admin", userId: uniqueId("user") };
    expect(await profilesRepo.getProfile(owner, profile.id)).toBeNull();
    expect(await profilesRepo.getProfile(admin, profile.id)).toBeNull();
    await expect(profilesRepo.saveProfile(owner, {})).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("treats a malformed id as not found", async () => {
    expect(await profilesRepo.getProfile(t1, "1; DROP TABLE profiles")).toBeNull();
  });
});
