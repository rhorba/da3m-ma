import type { PublishedProgram } from "@/lib/catalog";
import { evaluateCatalog, profileDataSchema, type ProgramOutcome } from "@/lib/engine";

/**
 * Which programme changes each subscriber hears about (Story 4.4). Pure: the cron
 * route feeds it subscriptions and the published catalogue and sends what comes out.
 *
 * A programme is news to a subscriber when its current version was published after
 * their last digest (or, before the first one, after they confirmed), and their saved
 * profile is eligible for it or could be with one more answer. Ineligible programmes
 * are left out: an alert that says "this changed, and you still can't apply" is noise.
 */

export type DueSubscription = {
  id: string;
  email: string;
  locale: string;
  profileData: unknown;
  /** Changes published after this are new to the subscriber. */
  since: Date;
};

export type DigestItem = {
  slug: string;
  outcome: Extract<ProgramOutcome, "eligible" | "needs_info">;
  version: number;
  content: PublishedProgram["content"];
};

export type Digest = {
  email: string;
  locale: string;
  /** Every subscription this email answers for, so all of them are marked as sent. */
  subscriptionIds: string[];
  items: DigestItem[];
};

const NEWS: ReadonlySet<ProgramOutcome> = new Set(["eligible", "needs_info"]);

function itemsFor(subscription: DueSubscription, catalogue: readonly PublishedProgram[]) {
  const parsed = profileDataSchema.safeParse(subscription.profileData);
  // A profile saved under an older schema is skipped rather than guessed at.
  if (!parsed.success) return [];

  const fresh = catalogue.filter((p) => p.publishedAt.getTime() > subscription.since.getTime());
  if (fresh.length === 0) return [];

  const byVersion = new Map(fresh.map((p) => [p.programVersionId, p]));
  return evaluateCatalog(
    parsed.data,
    fresh.map((p) => ({
      programId: p.programId,
      programVersionId: p.programVersionId,
      rules: p.rules,
    })),
  )
    .filter((result) => NEWS.has(result.outcome))
    .map((result): DigestItem => {
      const program = byVersion.get(result.programVersionId)!;
      return {
        slug: program.slug,
        outcome: result.outcome as DigestItem["outcome"],
        version: program.version,
        content: program.content,
      };
    });
}

/**
 * One digest per address, however many profiles it follows: that is the per-address
 * daily cap, given the cron runs once a day and only picks subscriptions not mailed in
 * the last day. Eligible programmes come first; within an outcome, by slug, so the same
 * input always produces the same email.
 */
export function buildDigests(
  subscriptions: readonly DueSubscription[],
  catalogue: readonly PublishedProgram[],
): Digest[] {
  const byEmail = new Map<string, Digest>();

  for (const subscription of subscriptions) {
    const email = subscription.email.toLowerCase();
    const digest = byEmail.get(email) ?? {
      email,
      locale: subscription.locale,
      subscriptionIds: [],
      items: [],
    };
    digest.subscriptionIds.push(subscription.id);
    for (const item of itemsFor(subscription, catalogue)) {
      const existing = digest.items.find((i) => i.slug === item.slug);
      if (!existing) {
        digest.items.push(item);
      } else if (item.outcome === "eligible") {
        // Two profiles, one address: the better news wins.
        existing.outcome = "eligible";
      }
    }
    byEmail.set(email, digest);
  }

  const rank = (o: DigestItem["outcome"]) => (o === "eligible" ? 0 : 1);
  return [...byEmail.values()]
    .filter((d) => d.items.length > 0)
    .map((digest) => ({
      ...digest,
      items: digest.items.sort(
        (a, b) => rank(a.outcome) - rank(b.outcome) || (a.slug < b.slug ? -1 : 1),
      ),
    }));
}
