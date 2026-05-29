import assert from "node:assert/strict";
import test from "node:test";

import {
  NewsletterInputError,
  isHoneypotSubmission,
  normalizeNewsletterEmail,
  sanitizeNewsletterSource,
  subscribeToNewsletter
} from "../src/newsletter/subscribe.mjs";

const createFakeDependencies = () => {
  const records = new Map();
  const calls = { sync: 0, welcome: 0, errors: 0 };

  return {
    calls,
    records,
    store: {
      async get(email) {
        return records.get(email) ?? null;
      },
      async upsert({ email, source }) {
        const existing = records.get(email);
        const record = {
          email,
          status: "subscribed",
          source,
          welcomeEmailSentAt: existing?.welcomeEmailSentAt || ""
        };
        records.set(email, record);
        return record;
      },
      async markResendSynced(email, contactId) {
        const record = records.get(email);
        records.set(email, { ...record, resendContactId: contactId });
      },
      async markWelcomeSent(email) {
        const record = records.get(email);
        records.set(email, { ...record, welcomeEmailSentAt: "2026-05-29T00:00:00.000Z" });
      },
      async markError() {
        calls.errors += 1;
      }
    },
    mailer: {
      async syncContact() {
        calls.sync += 1;
        return { contactId: "contact_123" };
      },
      async sendWelcome() {
        calls.welcome += 1;
      }
    },
    logger: { error() {} }
  };
};

test("newsletter email and source normalization are conservative", () => {
  assert.equal(normalizeNewsletterEmail("  PERSON@Example.COM "), "person@example.com");
  assert.equal(normalizeNewsletterEmail("bad-address"), "");
  assert.equal(sanitizeNewsletterSource(" Dashboard Intel Strip! "), "dashboard-intel-strip");
});

test("newsletter honeypot submissions return success without dependencies", async () => {
  assert.equal(isHoneypotSubmission({ website: "https://spam.example" }), true);
  const result = await subscribeToNewsletter({
    email: "not an email",
    website: "https://spam.example"
  });

  assert.deepEqual(result, { ok: true, status: "subscribed", honeypot: true });
});

test("newsletter subscription is idempotent and sends one welcome email", async () => {
  const deps = createFakeDependencies();

  const first = await subscribeToNewsletter({ email: "Reader@Example.com", source: "Dashboard" }, deps);
  const second = await subscribeToNewsletter({ email: "reader@example.com", source: "Dashboard" }, deps);

  assert.equal(first.status, "subscribed");
  assert.equal(second.status, "already_subscribed");
  assert.equal(deps.calls.sync, 2);
  assert.equal(deps.calls.welcome, 1);
  assert.equal(deps.records.get("reader@example.com").resendContactId, "contact_123");
});

test("newsletter still succeeds when Resend sync fails after persistence", async () => {
  const deps = createFakeDependencies();
  deps.mailer.syncContact = async () => {
    throw new Error("Resend temporary failure");
  };

  const result = await subscribeToNewsletter({ email: "reader@example.com" }, deps);

  assert.equal(result.status, "subscribed");
  assert.equal(deps.calls.errors, 1);
  assert.equal(deps.records.get("reader@example.com").status, "subscribed");
});

test("newsletter rejects invalid email addresses", async () => {
  await assert.rejects(
    () => subscribeToNewsletter({ email: "nope" }, createFakeDependencies()),
    NewsletterInputError
  );
});
