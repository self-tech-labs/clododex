import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

import { asString, trimText } from "../arena/core.mjs";

const DEFAULT_SOURCE = "clododex-dashboard";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedSql = null;
let cachedResend = null;
let schemaReady = null;

export class NewsletterInputError extends Error {
  constructor(message = "invalid_email") {
    super(message);
    this.name = "NewsletterInputError";
  }
}

export class NewsletterUnavailableError extends Error {
  constructor(message = "newsletter_unavailable") {
    super(message);
    this.name = "NewsletterUnavailableError";
  }
}

const requiredEnv = (env, key) => {
  const value = asString(env?.[key]).trim();
  if (!value) {
    throw new NewsletterUnavailableError(`Missing ${key}`);
  }
  return value;
};

export const normalizeNewsletterEmail = (value) => {
  const email = asString(value).trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "";
  }
  return email;
};

export const sanitizeNewsletterSource = (value) => {
  const source = asString(value, DEFAULT_SOURCE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimText(source || DEFAULT_SOURCE, 80);
};

export const isHoneypotSubmission = (input) => Boolean(asString(input?.website).trim());

const asTimestamp = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return asString(value);
};

const normalizeSubscriberRecord = (row = {}) => ({
  email: asString(row.email),
  status: asString(row.status, "subscribed"),
  source: asString(row.source, DEFAULT_SOURCE),
  resendContactId: asString(row.resend_contact_id),
  resendSegmentSyncedAt: asTimestamp(row.resend_segment_synced_at),
  welcomeEmailSentAt: asTimestamp(row.welcome_email_sent_at),
  createdAt: asTimestamp(row.created_at),
  updatedAt: asTimestamp(row.updated_at)
});

export const buildWelcomeEmail = () => ({
  subject: "You're on the Clododex intel feed",
  text: [
    "You are subscribed to Clododex.",
    "",
    "Future drops will focus on the latest Intel Feed and Power Moves updates from the AI-agent arena.",
    "",
    "Clododex"
  ].join("\n"),
  html: [
    '<div style="font-family:Inter,Arial,sans-serif;background:#080911;color:#f4f4f8;padding:32px">',
    '<div style="max-width:560px;margin:0 auto;border:1px solid #272a3a;padding:24px;background:#101221">',
    '<p style="margin:0 0 12px;color:#ffcb3d;font:12px monospace;letter-spacing:.12em;text-transform:uppercase">Clododex intel feed</p>',
    '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">You are on the list.</h1>',
    '<p style="margin:0 0 12px;line-height:1.6;color:#d8d8e6">Future drops will focus on the latest Intel Feed and Power Moves updates from the AI-agent arena.</p>',
    '<p style="margin:24px 0 0;color:#8f94b8;font:12px monospace">Clododex</p>',
    "</div>",
    "</div>"
  ].join("")
});

const getSql = (env = process.env) => {
  if (!cachedSql) {
    cachedSql = neon(requiredEnv(env, "DATABASE_URL"));
  }
  return cachedSql;
};

const getResend = (env = process.env) => {
  if (!cachedResend) {
    cachedResend = new Resend(requiredEnv(env, "RESEND_API_KEY"));
  }
  return cachedResend;
};

export const ensureNewsletterSchema = async (sql) => {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        email TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'subscribed',
        source TEXT NOT NULL DEFAULT 'clododex-dashboard',
        resend_contact_id TEXT,
        resend_segment_synced_at TIMESTAMPTZ,
        welcome_email_sent_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
};

export const createNeonNewsletterStore = (env = process.env) => {
  const sql = getSql(env);

  return {
    async get(email) {
      await ensureNewsletterSchema(sql);
      const rows = await sql`
        SELECT email, status, source, resend_contact_id, resend_segment_synced_at, welcome_email_sent_at, created_at, updated_at
        FROM newsletter_subscribers
        WHERE email = ${email}
      `;
      return rows[0] ? normalizeSubscriberRecord(rows[0]) : null;
    },

    async upsert({ email, source }) {
      await ensureNewsletterSchema(sql);
      const rows = await sql`
        INSERT INTO newsletter_subscribers (email, status, source)
        VALUES (${email}, 'subscribed', ${source})
        ON CONFLICT (email) DO UPDATE SET
          status = 'subscribed',
          source = EXCLUDED.source,
          updated_at = now(),
          last_subscribed_at = now()
        RETURNING email, status, source, resend_contact_id, resend_segment_synced_at, welcome_email_sent_at, created_at, updated_at
      `;
      return normalizeSubscriberRecord(rows[0]);
    },

    async markResendSynced(email, contactId) {
      await sql`
        UPDATE newsletter_subscribers
        SET resend_contact_id = ${contactId || null},
            resend_segment_synced_at = now(),
            last_error = NULL,
            updated_at = now()
        WHERE email = ${email}
      `;
    },

    async markWelcomeSent(email) {
      await sql`
        UPDATE newsletter_subscribers
        SET welcome_email_sent_at = now(),
            last_error = NULL,
            updated_at = now()
        WHERE email = ${email}
      `;
    },

    async markError(email, error) {
      await sql`
        UPDATE newsletter_subscribers
        SET last_error = ${trimText(error instanceof Error ? error.message : String(error), 500)},
            updated_at = now()
        WHERE email = ${email}
      `;
    }
  };
};

const hasDuplicateContactError = (error) => /already|exists|duplicate|409|conflict/i.test(JSON.stringify(error));

const toResendFailure = (error, action) =>
  error instanceof NewsletterUnavailableError
    ? error
    : new NewsletterUnavailableError(`Resend ${action} failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`);

const throwIfResendError = (result, action) => {
  if (result?.error) {
    throw new NewsletterUnavailableError(`Resend ${action} failed: ${JSON.stringify(result.error)}`);
  }
  return result?.data ?? {};
};

export const createResendNewsletterMailer = (env = process.env) => {
  const resend = getResend(env);
  const from = requiredEnv(env, "RESEND_FROM");
  const segmentId = requiredEnv(env, "RESEND_SEGMENT_ID");

  return {
    async syncContact({ email, source }) {
      const properties = {
        source,
        product: "clododex",
        newsletter: "intel-feed"
      };
      let contactId = "";
      let created;

      try {
        created = await resend.contacts.create({
          email,
          unsubscribed: false,
          properties,
          segments: [segmentId]
        });
      } catch (error) {
        if (!hasDuplicateContactError(error)) {
          throw toResendFailure(error, "contact create");
        }
        created = { error };
      }

      if (created?.error && !hasDuplicateContactError(created.error)) {
        throwIfResendError(created, "contact create");
      }

      if (created?.error) {
        let updated;
        try {
          updated = await resend.contacts.update({
            email,
            unsubscribed: false,
            properties
          });
        } catch (error) {
          throw toResendFailure(error, "contact update");
        }
        contactId = asString(throwIfResendError(updated, "contact update").id);
      } else {
        contactId = asString(created?.data?.id);
      }

      if (created?.error) {
        let segmented;
        try {
          segmented = await resend.contacts.segments.add({
            email,
            segmentId
          });
        } catch (error) {
          if (!hasDuplicateContactError(error)) {
            throw toResendFailure(error, "segment add");
          }
          segmented = { error };
        }
        if (segmented?.error && !hasDuplicateContactError(segmented.error)) {
          throwIfResendError(segmented, "segment add");
        }
      }

      return { contactId };
    },

    async sendWelcome({ email }) {
      const content = buildWelcomeEmail();
      let sent;
      try {
        sent = await resend.emails.send({
          from,
          to: email,
          subject: content.subject,
          html: content.html,
          text: content.text,
          tags: [{ name: "category", value: "newsletter_welcome" }]
        });
      } catch (error) {
        throw toResendFailure(error, "welcome email");
      }
      return throwIfResendError(sent, "welcome email");
    }
  };
};

export const subscribeToNewsletter = async (input, dependencies = {}) => {
  if (isHoneypotSubmission(input)) {
    return { ok: true, status: "subscribed", honeypot: true };
  }

  const email = normalizeNewsletterEmail(input?.email);
  if (!email) {
    throw new NewsletterInputError();
  }

  const source = sanitizeNewsletterSource(input?.source);
  const store = dependencies.store ?? createNeonNewsletterStore(dependencies.env);
  const logger = dependencies.logger ?? console;
  const existing = await store.get(email);
  const status = existing?.status === "subscribed" ? "already_subscribed" : "subscribed";
  const subscriber = await store.upsert({ email, source });

  try {
    const mailer = dependencies.mailer ?? createResendNewsletterMailer(dependencies.env);
    const synced = await mailer.syncContact({ email, source });
    await store.markResendSynced(email, synced.contactId);

    if (!existing?.welcomeEmailSentAt && !subscriber.welcomeEmailSentAt) {
      await mailer.sendWelcome({ email });
      await store.markWelcomeSent(email);
    }
  } catch (error) {
    await store.markError(email, error);
    logger.error?.("Newsletter Resend sync failed", error);
  }

  return { ok: true, status, email };
};
