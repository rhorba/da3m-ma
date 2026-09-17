"use server";

import { headers } from "next/headers";
import { ensureAnonActor } from "@/lib/auth";
import { getCatalogueReadRepository } from "@/lib/catalog";
import { profileDataSchema } from "@/lib/engine";
import { getProfilesRepository } from "@/lib/profiles";
import { clientIpFrom, getWizardRateLimiter } from "@/lib/rate-limit";
import { buildReport, getReportsRepository } from "@/lib/reports";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * The wizard's two writes. Public routes never touch Clerk (ADR-7), so both resolve the
 * visitor from the anonymous cookie alone.
 */

export type WizardActionResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" };

/**
 * Keeps a partially answered profile after every step, so a visitor who comes back on
 * another device does not start over. Not rate limited: it writes one row per visitor,
 * and a visitor who cannot save loses their answers.
 */
export async function saveStep(data: unknown): Promise<WizardActionResult> {
  const parsed = profileDataSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const actor = await ensureAnonActor();
  await getProfilesRepository().saveProfile(actor, parsed.data);
  return { ok: true };
}

/**
 * Runs the catalogue against the finished profile and stores the report, then sends the
 * visitor to it. Rate limited on both the address and the anonymous token: the address
 * alone is shared behind carrier NAT, and the token alone is attacker-chosen.
 */
export async function submitWizard(locale: AppLocale, data: unknown): Promise<WizardActionResult> {
  const parsed = profileDataSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const actor = await ensureAnonActor();
  const ip = clientIpFrom((await headers()).get("x-forwarded-for"));

  // Charged before anything is written, so a rejected submit leaves no rows behind.
  const decision = await getWizardRateLimiter().limit([`ip:${ip}`, `anon:${actor.tokenHash}`]);
  if (!decision.allowed) return { ok: false, error: "rate_limited" };

  const profile = await getProfilesRepository().saveProfile(actor, parsed.data);
  const catalogue = await getCatalogueReadRepository().listPublished();
  const report = await getReportsRepository().createReport(
    actor,
    profile.id,
    buildReport(parsed.data, catalogue),
  );

  redirect({ href: `/resultats/${report.id}`, locale });
  // `redirect` throws to navigate, so this line is unreachable at runtime.
  return { ok: true };
}
