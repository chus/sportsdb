"use client";

import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";

/**
 * Public logged-out newsletter capture (footer). Double opt-in: submitting
 * sends a confirmation email; nothing is ever sent without the confirm click.
 * This is the only way anonymous SEO visitors can join the owned audience —
 * before it, the list could only grow from registered users.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setState("done");
        setMessage(data.message || "Check your inbox to confirm.");
      } else {
        setState("error");
        setMessage(data.error || "Something went wrong — try again.");
      }
    } catch {
      setState("error");
      setMessage("Something went wrong — try again.");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500">
        <Check className="w-4 h-4 shrink-0" />
        {message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-faint" />
        <span className="text-sm font-semibold text-ink">Weekly football data roundup</span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
        </button>
      </form>
      <p className="text-xs text-faint mt-2">
        Fresh studies &amp; rankings, Sundays. Double opt-in, unsubscribe anytime.
      </p>
      {state === "error" && <p className="text-xs text-red-500 mt-1">{message}</p>}
    </div>
  );
}
