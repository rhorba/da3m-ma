import { verifyWebhook } from "@clerk/backend/webhooks";
import { mapClerkRole } from "@/lib/auth";
import type { ClerkSyncRepository } from "./sync.repository";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message, request_id: `req_${crypto.randomUUID()}` } },
    { status },
  );
}

export function createClerkWebhookHandler(deps: {
  sync: ClerkSyncRepository;
  /** Defaults to CLERK_WEBHOOK_SIGNING_SECRET, read by Clerk. */
  signingSecret?: string;
}) {
  return async function handle(request: Request): Promise<Response> {
    let event;
    try {
      event = await verifyWebhook(
        request,
        deps.signingSecret ? { signingSecret: deps.signingSecret } : undefined,
      );
    } catch {
      return errorResponse(400, "INVALID_SIGNATURE", "Webhook signature verification failed.");
    }

    switch (event.type) {
      case "organization.created":
      case "organization.updated":
        await deps.sync.upsertOrganization(event.data.id, event.data.name);
        break;
      case "organization.deleted":
        if (event.data.id) await deps.sync.deleteOrganization(event.data.id);
        break;
      case "organizationMembership.created":
      case "organizationMembership.updated":
        await deps.sync.upsertMembership({
          clerkOrgId: event.data.organization.id,
          orgName: event.data.organization.name,
          clerkUserId: event.data.public_user_data.user_id,
          role: mapClerkRole(event.data.role),
        });
        break;
      case "organizationMembership.deleted":
        await deps.sync.deleteMembership(
          event.data.organization.id,
          event.data.public_user_data.user_id,
        );
        break;
      default:
        // Other Clerk events are not used by Da3m; acknowledge so Clerk stops retrying.
        break;
    }

    return new Response(null, { status: 204 });
  };
}
