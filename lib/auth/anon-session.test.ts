import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The anonymous cookie is what separates one visitor's reports from another's, so its
 * flags are a security control (security §3), not a detail.
 */

const jar = {
  store: new Map<string, string>(),
  set: vi.fn(),
  get: vi.fn((name: string) => {
    const value = jar.store.get(name);
    return value === undefined ? undefined : { name, value };
  }),
};

vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { ANON_COOKIE_MAX_AGE, ANON_COOKIE_OPTIONS, ensureAnonActor, readAnonActor } =
  await import("./anon-session");
const { ANON_COOKIE_NAME, hashAnonToken } = await import("./actor");

beforeEach(() => {
  jar.store.clear();
  jar.set.mockClear();
});

describe("readAnonActor", () => {
  it("recognises a visitor who already has a token", async () => {
    jar.store.set(ANON_COOKIE_NAME, "token-abc");

    expect(await readAnonActor()).toEqual({
      kind: "anonymous",
      tokenHash: hashAnonToken("token-abc"),
    });
  });

  it("returns nobody before a visitor has one", async () => {
    expect(await readAnonActor()).toBeNull();
  });

  it("never sets a cookie: a Server Component cannot", async () => {
    await readAnonActor();
    expect(jar.set).not.toHaveBeenCalled();
  });
});

describe("ensureAnonActor", () => {
  it("keeps an existing token rather than rotating it", async () => {
    jar.store.set(ANON_COOKIE_NAME, "token-abc");

    const actor = await ensureAnonActor();

    expect(actor.tokenHash).toBe(hashAnonToken("token-abc"));
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("mints a token on a visitor's first submission", async () => {
    const actor = await ensureAnonActor();

    expect(jar.set).toHaveBeenCalledOnce();
    const [name, token, options] = jar.set.mock.calls[0]!;
    expect(name).toBe(ANON_COOKIE_NAME);
    expect(actor.tokenHash).toBe(hashAnonToken(token));
    expect(options).toBe(ANON_COOKIE_OPTIONS);
  });

  it("stores only the hash, never the token itself", async () => {
    const actor = await ensureAnonActor();
    const [, token] = jar.set.mock.calls[0]!;

    expect(actor.tokenHash).not.toBe(token);
    expect(actor.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives two visitors different tokens", async () => {
    const first = await ensureAnonActor();
    jar.store.clear();
    const second = await ensureAnonActor();

    expect(first.tokenHash).not.toBe(second.tokenHash);
  });
});

describe("cookie flags", () => {
  it("is HttpOnly, SameSite=Lax and site-wide", () => {
    expect(ANON_COOKIE_OPTIONS).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("lasts two years, so a returning visitor keeps their results", () => {
    expect(ANON_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 730);
    expect(ANON_COOKIE_OPTIONS.maxAge).toBe(ANON_COOKIE_MAX_AGE);
  });

  it("is only sent over plain HTTP outside production", () => {
    expect(ANON_COOKIE_OPTIONS.secure).toBe(process.env.NODE_ENV === "production");
  });
});
