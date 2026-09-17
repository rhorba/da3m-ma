import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Webhook } from "svix";
import { describe, expect, it } from "vitest";
import { createClerkSyncRepository, createClerkWebhookHandler } from "@/lib/cabinet";
import { memberships, organizations } from "@/lib/db/schema";
import { uniqueId, connectTestDatabase } from "./helpers";

// Story 1.3 — Clerk organisation + membership sync.

const db = connectTestDatabase();
const secret = `whsec_${randomBytes(24).toString("base64")}`;
const handle = createClerkWebhookHandler({
  sync: createClerkSyncRepository(db),
  signingSecret: secret,
});

function signedRequest(body: unknown, signingSecret = secret): Request {
  const payload = JSON.stringify(body);
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();
  const signature = new Webhook(signingSecret).sign(id, timestamp, payload);
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: payload,
  });
}

const orgEvent = (type: string, clerkOrgId: string, name: string) => ({
  type,
  object: "event",
  data: { id: clerkOrgId, object: "organization", name, slug: name.toLowerCase() },
});

const membershipEvent = (type: string, clerkOrgId: string, userId: string, role: string) => ({
  type,
  object: "event",
  data: {
    id: uniqueId("orgmem"),
    object: "organization_membership",
    role,
    organization: { id: clerkOrgId, object: "organization", name: "Hicham Conseil" },
    public_user_data: { user_id: userId, identifier: "hicham@example.ma" },
  },
});

async function findOrg(clerkOrgId: string) {
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId));
  return row;
}

async function findMembership(orgId: string, userId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.clerkUserId, userId)));
  return row;
}

describe("Clerk webhook", () => {
  it("creates an organisation and an owner membership", async () => {
    const clerkOrgId = uniqueId("org");
    const userId = uniqueId("user");

    const created = await handle(
      signedRequest(orgEvent("organization.created", clerkOrgId, "Hicham Conseil")),
    );
    expect(created.status).toBe(204);
    const org = await findOrg(clerkOrgId);
    expect(org).toMatchObject({ name: "Hicham Conseil", plan: "trial" });

    const joined = await handle(
      signedRequest(
        membershipEvent("organizationMembership.created", clerkOrgId, userId, "org:admin"),
      ),
    );
    expect(joined.status).toBe(204);
    expect(await findMembership(org!.id, userId)).toMatchObject({ role: "owner" });
  });

  it("handles a membership arriving before its organisation, and repeated delivery", async () => {
    const clerkOrgId = uniqueId("org");
    const userId = uniqueId("user");
    const event = membershipEvent(
      "organizationMembership.created",
      clerkOrgId,
      userId,
      "org:member",
    );

    expect((await handle(signedRequest(event))).status).toBe(204);
    expect((await handle(signedRequest(event))).status).toBe(204);

    const org = await findOrg(clerkOrgId);
    expect(org).toBeDefined();
    const rows = await db.select().from(memberships).where(eq(memberships.orgId, org!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clerkUserId: userId, role: "consultant" });
  });

  it("updates roles, removes memberships and deletes organisations", async () => {
    const clerkOrgId = uniqueId("org");
    const userId = uniqueId("user");
    await handle(
      signedRequest(
        membershipEvent("organizationMembership.created", clerkOrgId, userId, "org:member"),
      ),
    );
    const org = await findOrg(clerkOrgId);

    await handle(
      signedRequest(
        membershipEvent("organizationMembership.updated", clerkOrgId, userId, "org:viewer"),
      ),
    );
    expect(await findMembership(org!.id, userId)).toMatchObject({ role: "viewer" });

    await handle(signedRequest(orgEvent("organization.updated", clerkOrgId, "Renamed Conseil")));
    expect(await findOrg(clerkOrgId)).toMatchObject({ name: "Renamed Conseil" });

    await handle(
      signedRequest(
        membershipEvent("organizationMembership.deleted", clerkOrgId, userId, "org:viewer"),
      ),
    );
    expect(await findMembership(org!.id, userId)).toBeUndefined();

    await handle(
      signedRequest({
        type: "organization.deleted",
        object: "event",
        data: { id: clerkOrgId, deleted: true },
      }),
    );
    expect(await findOrg(clerkOrgId)).toBeUndefined();
  });

  it("acknowledges unrelated event types without writing anything", async () => {
    const response = await handle(
      signedRequest({ type: "user.created", object: "event", data: { id: uniqueId("user") } }),
    );
    expect(response.status).toBe(204);
  });

  it("rejects an invalid signature with 400 and writes nothing", async () => {
    const clerkOrgId = uniqueId("org");
    const forged = `whsec_${randomBytes(24).toString("base64")}`;
    const response = await handle(
      signedRequest(orgEvent("organization.created", clerkOrgId, "Forged"), forged),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; request_id: string } };
    expect(body.error.code).toBe("INVALID_SIGNATURE");
    expect(body.error.request_id).toMatch(/^req_/);
    expect(await findOrg(clerkOrgId)).toBeUndefined();
  });

  it("rejects a request with no signature headers", async () => {
    const response = await handle(
      new Request("http://localhost/api/webhooks/clerk", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(400);
  });
});
