"use server";

import { headers } from "next/headers";
import { readAnonActor } from "@/lib/auth";
import { getCatalogueReadRepository } from "@/lib/catalog";
import { isProfileField, profileDataSchema } from "@/lib/engine";
import { getProfilesRepository } from "@/lib/profiles";
import { clientIpFrom, getWizardRateLimiter } from "@/lib/rate-limit";
import { buildReport, getReportsRepository } from "@/lib/reports";

/**
 * Answering one follow-up question (Story 3.5). Reports are immutable (ADR-4), so this
 * writes a new one against the current catalogue and hands back its id; the page swaps
 * to it in place rather than navigating away.
 */

export type AnswerResult =
  { ok: true; reportId: string } | { ok: false; error: "invalid" | "rate_limited" | "not_found" };

export async function answerQuestion(
  reportId: string,
  field: string,
  value: unknown,
): Promise<AnswerResult> {
  if (!isProfileField(field)) return { ok: false, error: "invalid" };

  const actor = await readAnonActor();
  if (!actor) return { ok: false, error: "not_found" };

  const reports = getReportsRepository();
  const previous = await reports.getReport(actor, reportId);
  if (!previous) return { ok: false, error: "not_found" };

  // The answer is merged into the profile the report was run against, then revalidated
  // as a whole: one field cannot be used to smuggle a bad value into the rest.
  const merged = profileDataSchema.safeParse({ ...previous.inputSnapshot, [field]: value });
  if (!merged.success) return { ok: false, error: "invalid" };

  const ip = clientIpFrom((await headers()).get("x-forwarded-for"));
  const decision = await getWizardRateLimiter().limit([`ip:${ip}`, `anon:${actor.tokenHash}`]);
  if (!decision.allowed) return { ok: false, error: "rate_limited" };

  const profile = await getProfilesRepository().saveProfile(actor, merged.data);
  const catalogue = await getCatalogueReadRepository().listPublished();
  const report = await reports.createReport(actor, profile.id, buildReport(merged.data, catalogue));

  return { ok: true, reportId: report.id };
}
