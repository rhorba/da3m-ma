import net from "node:net";

/**
 * SSRF guard for the source watcher (security baseline §2). A URL is fetched only when it
 * is https, on an allowlisted host, on the default port, without credentials, and every
 * address it resolves to is public.
 *
 * Residual risk, accepted: DNS could change between our lookup and fetch's own lookup.
 * The host allowlist (a handful of public-agency domains) bounds what that could reach.
 */

const blocked = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return !blocked.check(mapped[1]!, "ipv4");
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export type GuardResult = { ok: true; url: URL } | { ok: false; reason: string };

export function parseAllowedHosts(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Checks the URL itself, before any network activity. */
export function checkUrl(raw: string, allowedHosts: ReadonlySet<string>): GuardResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `Not a valid URL: ${raw}` };
  }
  if (url.protocol !== "https:") return { ok: false, reason: `Only https is allowed: ${raw}` };
  if (url.username || url.password)
    return { ok: false, reason: "URLs with credentials are not allowed" };
  if (url.port !== "") return { ok: false, reason: `Non-default port not allowed: ${url.port}` };
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: `Host not in WATCH_ALLOWED_HOSTS: ${url.hostname}` };
  }
  return { ok: true, url };
}

export type ResolveAll = (hostname: string) => Promise<string[]>;

/** Checks the URL, then that every resolved address is public. */
export async function guardUrl(
  raw: string,
  allowedHosts: ReadonlySet<string>,
  resolveAll: ResolveAll,
): Promise<GuardResult> {
  const checked = checkUrl(raw, allowedHosts);
  if (!checked.ok) return checked;
  let addresses: string[];
  try {
    addresses = await resolveAll(checked.url.hostname);
  } catch {
    return { ok: false, reason: `DNS lookup failed for ${checked.url.hostname}` };
  }
  if (addresses.length === 0)
    return { ok: false, reason: `No addresses for ${checked.url.hostname}` };
  const internal = addresses.find((a) => !isPublicAddress(a));
  if (internal)
    return { ok: false, reason: `${checked.url.hostname} resolves to a non-public address` };
  return checked;
}
