import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendMailer, getMailer, MailerError } from "./mailer";

const email = { to: "a@example.com", subject: "S", text: "T", html: "<p>T</p>" };

describe("Resend mailer", () => {
  it("posts the email to Resend with the key and sender", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    await createResendMailer({ apiKey: "re_test", from: "Da3m <a@da3m.ma>", fetch }).send({
      ...email,
      headers: { "List-Unsubscribe": "<x>" },
    });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Da3m <a@da3m.ma>",
      to: ["a@example.com"],
      subject: "S",
      text: "T",
      html: "<p>T</p>",
      headers: { "List-Unsubscribe": "<x>" },
    });
  });

  it("fails loudly when Resend refuses", async () => {
    const fetch = vi.fn(async () => new Response("domain not verified", { status: 403 }));
    const mailer = createResendMailer({ apiKey: "k", from: "f", fetch });
    await expect(mailer.send(email)).rejects.toThrow(MailerError);
  });
});

describe("getMailer", () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  afterEach(() => {
    process.env.RESEND_API_KEY = saved.key;
    process.env.EMAIL_FROM = saved.from;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY;
    if (saved.from === undefined) delete process.env.EMAIL_FROM;
  });

  it("is null until both the key and the sender are configured", () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "f";
    expect(getMailer()).toBeNull();
    process.env.RESEND_API_KEY = "k";
    expect(getMailer()).not.toBeNull();
  });
});
