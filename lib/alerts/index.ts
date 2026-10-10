export { buildDigests, type Digest, type DigestItem, type DueSubscription } from "./digest";
export { asLocale, confirmationEmail, digestEmail } from "./emails";
export {
  createResendMailer,
  getMailer,
  MailerError,
  type Mailer,
  type OutgoingEmail,
} from "./mailer";
export {
  CONFIRMATIONS_PER_DAY,
  createAlertsRepository,
  DIGEST_INTERVAL_MS,
  getAlertsRepository,
  normaliseEmail,
  type AlertsRepository,
  type AlertStatus,
  type SubscribeResult,
} from "./repository";
export {
  createAlertsDigestHandler,
  subscribeToAlerts,
  type DigestSummary,
  type SubscribeOutcome,
} from "./service";
export {
  CONFIRM_TTL_SECONDS,
  createAlertToken,
  verifyAlertToken,
  type AlertTokenPayload,
  type AlertTokenPurpose,
} from "./tokens";
