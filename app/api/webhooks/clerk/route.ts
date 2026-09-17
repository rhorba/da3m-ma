import { createClerkWebhookHandler, getClerkSyncRepository } from "@/lib/cabinet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return createClerkWebhookHandler({ sync: getClerkSyncRepository() })(request);
}
