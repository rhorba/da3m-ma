import { describe, expect, it } from "vitest";
import { AccessDeniedError, hashAnonToken, type Actor } from "@/lib/auth";
import { createProfilesRepository } from "@/lib/profiles";
import { buildReport, createReportsRepository } from "@/lib/reports";
import { connectTestDatabase, seedFirm, uniqueId } from "./helpers";

// Story 4.3 — anonymous work becomes the visitor's own when they sign in, and stays
// out of reach of anyone else holding a cookie.

const db = connectTestDatabase();
const profilesRepo = createProfilesRepository(db);
const reports = createReportsRepository(db);

const anon = (): Extract<Actor, { kind: "anonymous" }> => ({
  kind: "anonymous",
  tokenHash: hashAnonToken(uniqueId("token")),
});

const user = (): Extract<Actor, { kind: "user" }> => ({
  kind: "user",
  userId: uniqueId("user"),
});

describe("claiming an anonymous profile", () => {
  it("transfers ownership to the signed-in user", async () => {
    const visitor = anon();
    const account = user();
    const before = await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });

    const claimed = await profilesRepo.claimProfiles(account, visitor.tokenHash);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe(before.id);
    expect(claimed[0]?.ownerUserId).toBe(account.userId);
    // The token is released, so nothing can match on it again.
    expect(claimed[0]?.anonTokenHash).toBeNull();
  });

  it("keeps the answers exactly as they were given", async () => {
    const visitor = anon();
    const account = user();
    const data = { legal_form: "sarl" as const, sector: "digital" as const };
    await profilesRepo.saveProfile(visitor, data);

    const [claimed] = await profilesRepo.claimProfiles(account, visitor.tokenHash);

    expect(claimed?.data).toEqual(data);
    expect(claimed?.schemaVersion).toBe(1);
  });

  it("brings the reports along, because they point at the profile", async () => {
    const visitor = anon();
    const account = user();
    const profile = await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });
    const report = await reports.createReport(visitor, profile.id, buildReport({}, []));

    // Before claiming, the account cannot see it.
    expect(await reports.getReport(account, report.id)).toBeNull();

    await profilesRepo.claimProfiles(account, visitor.tokenHash);

    const owned = await reports.getReport(account, report.id);
    expect(owned?.id).toBe(report.id);
    // And the visitor's old token no longer reaches it.
    expect(await reports.getReport(visitor, report.id)).toBeNull();
  });

  it("makes the profile readable through the account afterwards", async () => {
    const visitor = anon();
    const account = user();
    const profile = await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });

    await profilesRepo.claimProfiles(account, visitor.tokenHash);

    expect((await profilesRepo.getProfile(account, profile.id))?.id).toBe(profile.id);
    expect(await profilesRepo.getProfile(visitor, profile.id)).toBeNull();
  });
});

describe("history after claiming", () => {
  it("lists the claimed reports under the account, newest first", async () => {
    const visitor = anon();
    const account = user();
    const profile = await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });
    const older = await reports.createReport(visitor, profile.id, buildReport({}, []));
    const newer = await reports.createReport(visitor, profile.id, buildReport({}, []));

    expect(await reports.listReports(account)).toEqual([]);

    await profilesRepo.claimProfiles(account, visitor.tokenHash);

    const history = await reports.listReports(account);
    expect(history.map((r) => r.id)).toEqual([newer.id, older.id]);
  });

  it("shows one visitor nothing of another's history", async () => {
    const mine = anon();
    const theirs = anon();
    const account = user();
    const profile = await profilesRepo.saveProfile(theirs, { legal_form: "sa" });
    await reports.createReport(theirs, profile.id, buildReport({}, []));
    await profilesRepo.saveProfile(mine, { legal_form: "sarl" });

    await profilesRepo.claimProfiles(account, mine.tokenHash);

    expect(await reports.listReports(account)).toEqual([]);
  });

  it("gives a firm member no B2C history", async () => {
    const { member } = await seedFirm(db, "Cabinet");
    expect(await reports.listReports(await member("owner"))).toEqual([]);
  });
});

describe("claiming is safe to repeat", () => {
  it("claims nothing the second time", async () => {
    const visitor = anon();
    const account = user();
    await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });

    expect(await profilesRepo.claimProfiles(account, visitor.tokenHash)).toHaveLength(1);
    expect(await profilesRepo.claimProfiles(account, visitor.tokenHash)).toHaveLength(0);
  });

  it("claims nothing when the token never had a profile", async () => {
    expect(await profilesRepo.claimProfiles(user(), hashAnonToken("never-used"))).toEqual([]);
  });

  it("claims nothing for an empty token", async () => {
    expect(await profilesRepo.claimProfiles(user(), "")).toEqual([]);
  });
});

describe("claiming cannot take what is not offered", () => {
  it("refuses to move a profile that another account already owns", async () => {
    const visitor = anon();
    const first = user();
    const second = user();
    await profilesRepo.saveProfile(visitor, { legal_form: "sarl" });
    await profilesRepo.claimProfiles(first, visitor.tokenHash);

    // Even holding the same token, the second account gets nothing.
    expect(await profilesRepo.claimProfiles(second, visitor.tokenHash)).toEqual([]);
  });

  it("leaves another visitor's profile untouched", async () => {
    const mine = anon();
    const theirs = anon();
    const account = user();
    await profilesRepo.saveProfile(mine, { legal_form: "sarl" });
    const other = await profilesRepo.saveProfile(theirs, { legal_form: "sa" });

    await profilesRepo.claimProfiles(account, mine.tokenHash);

    expect((await profilesRepo.getProfile(theirs, other.id))?.ownerUserId).toBeNull();
  });

  it("refuses an anonymous actor: there is no account to claim into", async () => {
    await expect(profilesRepo.claimProfiles(anon(), "hash")).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("refuses a firm member, who works from client records", async () => {
    const { member } = await seedFirm(db, "Cabinet");
    const consultant = await member("consultant");

    await expect(profilesRepo.claimProfiles(consultant, "hash")).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });
});
