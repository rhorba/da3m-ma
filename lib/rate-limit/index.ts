import { createMemoryRateLimiter, WIZARD_SUBMIT_WINDOW, type RateLimiter } from "./sliding-window";

export {
  clientIpFrom,
  createMemoryRateLimiter,
  WIZARD_SUBMIT_WINDOW,
  type MemoryLimiterDeps,
  type RateLimitDecision,
  type RateLimiter,
  type WindowConfig,
} from "./sliding-window";

let wizardLimiter: RateLimiter | undefined;

/** One limiter per process, so hits accumulate across requests. */
export function getWizardRateLimiter(): RateLimiter {
  wizardLimiter ??= createMemoryRateLimiter(WIZARD_SUBMIT_WINDOW);
  return wizardLimiter;
}
