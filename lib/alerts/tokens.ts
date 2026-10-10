import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The links in alert emails (Story 4.4): confirm a subscription, or leave it.
 *
 * Signed rather than stored. Every digest has to carry a working unsubscribe link, and
 * a token kept only as a hash cannot be put back into the next email; a signed one can
 * be minted again at send time, and every link ever sent keeps working. The signature
 * covers the purpose, so a confirm link can never be replayed as an unsubscribe and vice
 * versa.
 */

export type AlertTokenPurpose = "confirm" | "unsubscribe";

export type AlertTokenPayload = {
  subscriptionId: string;
  purpose: AlertTokenPurpose;
  /** Unix seconds; null for links that must work for as long as emails exist. */
  expiresAt: number | null;
};

/** A confirmation link is a one-off: a week is long enough to find it in a spam folder. */
export const CONFIRM_TTL_SECONDS = 7 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function createAlertToken(payload: AlertTokenPayload, secret: string): string {
  const body = [payload.purpose, payload.subscriptionId, payload.expiresAt ?? "-"].join(".");
  return `${body}.${sign(body, secret).toString("base64url")}`;
}

/** The payload if the token is authentic, unexpired and for `purpose`; null otherwise. */
export function verifyAlertToken(
  token: string,
  purpose: AlertTokenPurpose,
  secret: string,
  now: Date,
): AlertTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [tokenPurpose, subscriptionId, expires, signature] = parts as [
    string,
    string,
    string,
    string,
  ];

  const expected = sign(`${tokenPurpose}.${subscriptionId}.${expires}`, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  if (tokenPurpose !== purpose || !UUID.test(subscriptionId)) return null;
  const expiresAt = expires === "-" ? null : Number(expires);
  if (expiresAt !== null && (!Number.isInteger(expiresAt) || expiresAt * 1000 < now.getTime())) {
    return null;
  }
  return { subscriptionId, purpose, expiresAt };
}
