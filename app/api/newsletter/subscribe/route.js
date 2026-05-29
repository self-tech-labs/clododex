import { NextResponse } from "next/server";

import {
  NewsletterInputError,
  NewsletterUnavailableError,
  subscribeToNewsletter
} from "../../../../src/newsletter/subscribe.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    const result = await subscribeToNewsletter(body);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    if (error instanceof NewsletterInputError) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    if (error instanceof NewsletterUnavailableError) {
      return NextResponse.json({ ok: false, error: "newsletter_unavailable" }, { status: 503 });
    }

    console.error("Newsletter subscription failed", error);
    return NextResponse.json({ ok: false, error: "newsletter_unavailable" }, { status: 503 });
  }
}
