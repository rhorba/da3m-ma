import { readAnonActor, rotateAnonToken, type Actor, type AnonActor } from "@/lib/auth";
import { getProfilesRepository, type Profile } from "./repository";

/**
 * Claiming anonymous work into an account (Story 4.3).
 *
 * A visitor answers the wizard without signing up, then signs in later; their profile
 * and every report run against it should simply be theirs. This runs on each visit to
 * the signed-in area, so it has to be cheap and idempotent — after the first claim
 * there is nothing left to match.
 *
 * Dependencies are injected in the same style as `resolveActor`, so the ordering rule
 * that matters — never rotate the token before the claim has succeeded — is tested
 * without a database or a cookie jar.
 */

export type ClaimDeps = {
  getAnonActor: () => Promise<AnonActor | null>;
  claimProfiles: (actor: Actor, tokenHash: string) => Promise<Profile[]>;
  rotateToken: () => Promise<unknown>;
};

export type ClaimResult = { claimed: number };

const liveDeps = (): ClaimDeps => ({
  getAnonActor: readAnonActor,
  claimProfiles: (actor, tokenHash) => getProfilesRepository().claimProfiles(actor, tokenHash),
  rotateToken: rotateAnonToken,
});

export async function claimAnonymousData(
  actor: Actor,
  deps: ClaimDeps = liveDeps(),
): Promise<ClaimResult> {
  // Only a signed-in individual owns B2C profiles; a firm member works from client
  // records instead, and their anonymous browsing is not theirs to absorb.
  if (actor.kind !== "user") return { claimed: 0 };

  const anon = await deps.getAnonActor();
  if (!anon) return { claimed: 0 };

  const claimed = await deps.claimProfiles(actor, anon.tokenHash);

  // Rotated only on success: if the claim failed, the token still points at data the
  // visitor has not yet been given, and discarding it would orphan their history.
  if (claimed.length > 0) await deps.rotateToken();

  return { claimed: claimed.length };
}
