/** Subscriptions `pnpm e2e:seed` creates for e2e/alerts.spec.ts (Story 4.4). */
export const E2E_ALERTS = {
  userId: "user_e2e_alerts",
  /** Reset to pending on every seed; the spec confirms it. */
  pendingId: "e2e00000-0000-4000-8000-000000000001",
  /** Reset to confirmed on every seed; the spec unsubscribes it. */
  activeId: "e2e00000-0000-4000-8000-000000000002",
} as const;
