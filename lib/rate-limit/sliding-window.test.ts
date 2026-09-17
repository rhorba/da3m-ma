import { beforeEach, describe, expect, it } from "vitest";
import { clientIpFrom, createMemoryRateLimiter, WIZARD_SUBMIT_WINDOW } from "./sliding-window";

const config = { limit: 3, windowMs: 1000 };

let clock = 0;
const now = () => clock;
const limiter = () => createMemoryRateLimiter(config, { now });

beforeEach(() => {
  clock = 1_000_000;
});

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit and counts down the remainder", async () => {
    const rl = limiter();

    expect(await rl.limit(["ip"])).toMatchObject({ allowed: true, remaining: 2 });
    expect(await rl.limit(["ip"])).toMatchObject({ allowed: true, remaining: 1 });
    expect(await rl.limit(["ip"])).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("denies the request past the limit without recording it", async () => {
    const rl = limiter();
    for (let i = 0; i < config.limit; i++) await rl.limit(["ip"]);

    const denied = await rl.limit(["ip"]);
    expect(denied).toMatchObject({ allowed: false, remaining: 0 });
    expect(denied.resetAt).toBe(clock + config.windowMs);

    // The rejected attempt must not push the window forward, or a hammering client
    // would lock itself out for ever.
    clock += config.windowMs + 1;
    expect(await rl.limit(["ip"])).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("frees exactly one slot as the window slides", async () => {
    const rl = limiter();
    await rl.limit(["ip"]);
    clock += 400;
    await rl.limit(["ip"]);
    await rl.limit(["ip"]);

    expect(await rl.limit(["ip"])).toMatchObject({ allowed: false });

    // 601ms later the first hit has aged out, the two at +400 have not.
    clock += 601;
    expect(await rl.limit(["ip"])).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("keeps separate keys independent", async () => {
    const rl = limiter();
    for (let i = 0; i < config.limit; i++) await rl.limit(["ip-a"]);

    expect(await rl.limit(["ip-a"])).toMatchObject({ allowed: false });
    expect(await rl.limit(["ip-b"])).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("denies when any one of several keys is exhausted", async () => {
    const rl = limiter();
    for (let i = 0; i < config.limit; i++) await rl.limit(["token"]);

    const decision = await rl.limit(["fresh-ip", "token"]);
    expect(decision.allowed).toBe(false);

    // The fresh key must not have been charged for a request that never happened.
    clock += config.windowMs + 1;
    expect(await rl.limit(["fresh-ip"])).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("reports the earliest reset when several keys are exhausted", async () => {
    const rl = limiter();
    for (let i = 0; i < config.limit; i++) await rl.limit(["old"]);
    clock += 100;
    for (let i = 0; i < config.limit; i++) await rl.limit(["new"]);

    const decision = await rl.limit(["old", "new"]);
    expect(decision.resetAt).toBe(clock - 100 + config.windowMs);
  });

  it("reports the remainder of the most-used key", async () => {
    const rl = limiter();
    await rl.limit(["busy"]);
    await rl.limit(["busy"]);

    expect(await rl.limit(["busy", "idle"])).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("allows a request that limits nothing", async () => {
    expect(await limiter().limit([])).toMatchObject({ allowed: true, remaining: config.limit });
  });

  it("forgets keys that have gone quiet for a full window", async () => {
    const rl = limiter();
    await rl.limit(["gone"]);

    clock += config.windowMs * 2;
    await rl.limit(["other"]);
    clock += config.windowMs * 2;
    await rl.limit(["other"]);

    expect(await rl.limit(["gone"])).toMatchObject({ allowed: true, remaining: 2 });
  });
});

describe("WIZARD_SUBMIT_WINDOW", () => {
  it("allows a realistic session but not a scrape", () => {
    expect(WIZARD_SUBMIT_WINDOW).toEqual({ limit: 20, windowMs: 3_600_000 });
  });
});

describe("clientIpFrom", () => {
  it("takes the client address, not the proxy hops", () => {
    expect(clientIpFrom("41.140.1.2, 10.0.0.1, 10.0.0.2")).toBe("41.140.1.2");
  });

  it("trims a single address", () => {
    expect(clientIpFrom(" 41.140.1.2 ")).toBe("41.140.1.2");
  });

  it("falls back to a shared bucket when the header is missing or empty", () => {
    expect(clientIpFrom(null)).toBe("unknown");
    expect(clientIpFrom(undefined)).toBe("unknown");
    expect(clientIpFrom("")).toBe("unknown");
    expect(clientIpFrom("  ")).toBe("unknown");
  });
});
