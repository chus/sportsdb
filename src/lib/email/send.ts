/**
 * Minimal transactional email via Resend's REST API (no SDK dependency).
 *
 * The outbound re-engagement channel the app was missing — weekly digests
 * and matchday reminders that pull users back (the retention loop existed
 * but had no way to reach anyone). Degrades gracefully: if RESEND_API_KEY
 * isn't set it logs and no-ops, so cron runs stay green until email is
 * configured. Set RESEND_API_KEY and EMAIL_FROM (a verified sender) to go
 * live.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] skipped (no RESEND_API_KEY) → would send "${subject}" to ${to}`);
    return false;
  }
  const from = process.env.EMAIL_FROM || "DataSports <noreply@datasports.co>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[email] send failed (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send error:", err);
    return false;
  }
}

/** Whether outbound email is configured (used to short-circuit digest crons). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
