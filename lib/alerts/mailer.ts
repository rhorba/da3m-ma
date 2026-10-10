/**
 * Sending email (Story 4.4). One interface so the alerts code can be tested without a
 * provider, and one implementation over Resend's HTTP API — a single POST does not
 * justify an SDK dependency.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** e.g. List-Unsubscribe, which mail clients turn into a one-click button. */
  headers?: Record<string, string>;
};

export type Mailer = { send(email: OutgoingEmail): Promise<void> };

export class MailerError extends Error {}

export function createResendMailer(deps: {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}): Mailer {
  const doFetch = deps.fetch ?? fetch;
  return {
    async send(email) {
      const response = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deps.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: deps.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: email.headers,
        }),
      });
      if (!response.ok) {
        // The body names the problem (bad key, unverified domain); never the address.
        const detail = (await response.text()).slice(0, 200);
        throw new MailerError(`Resend rejected the email: ${response.status} ${detail}`);
      }
    },
  };
}

/** The configured mailer, or null until RESEND_API_KEY and EMAIL_FROM are set. */
export function getMailer(): Mailer | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? createResendMailer({ apiKey, from }) : null;
}
