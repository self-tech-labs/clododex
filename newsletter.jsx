"use client";

import React from "react";

export function NewsletterSignup() {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [state, setState] = React.useState({ status: "idle", message: "" });

  const onSubmit = async (event) => {
    event.preventDefault();
    setState({ status: "loading", message: "" });

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website,
          source: "dashboard-intel-strip"
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.error === "invalid_email" ? "Enter a valid email." : "Subscription is unavailable."
        });
        return;
      }

      setEmail("");
      setWebsite("");
      setState({
        status: "success",
        message: payload.status === "already_subscribed" ? "Already subscribed." : "Subscribed."
      });
    } catch {
      setState({ status: "error", message: "Subscription is unavailable." });
    }
  };

  return (
    <form className="newsletter-strip" onSubmit={onSubmit}>
      <div className="newsletter-copy">
        <span className="newsletter-kicker">INTEL DROP</span>
        <strong>Latest Intel Feed + Power Moves</strong>
      </div>
      <div className="newsletter-controls">
        <label className="newsletter-honeypot">
          Website
          <input
            tabIndex="-1"
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
        <input
          className="newsletter-input"
          type="email"
          value={email}
          placeholder="agent@arena.dev"
          autoComplete="email"
          aria-label="Email address"
          onChange={(event) => setEmail(event.target.value)}
          disabled={state.status === "loading"}
        />
        <button className="newsletter-button" type="submit" disabled={state.status === "loading"}>
          {state.status === "loading" ? "SENDING" : "SUBSCRIBE"}
        </button>
      </div>
      <div className={`newsletter-status ${state.status}`} aria-live="polite">
        {state.message}
      </div>
    </form>
  );
}
