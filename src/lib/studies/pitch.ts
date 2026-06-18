import OpenAI from "openai";
import type { Study } from "./generators";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

/**
 * Draft a short outreach pitch for a data study — the kind of thing you'd send
 * to a reporter query (HARO/Qwoted) or a football writer. The agent DRAFTS; a
 * human edits in a real insight and sends (automated outreach gets ignored, and
 * HARO now bans AI spam). Returns null without an OpenAI key.
 */
export async function draftPitch(study: Study): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const top5 = study.data.rows
    .slice(0, 5)
    .map((r) => `${r.rank}. ${r.player} (${r.team ?? "—"}) — ${Object.values(r.values)[0]}`)
    .join("\n");
  const url = `${BASE_URL}/studies/${study.slug}`;

  try {
    const openai = new OpenAI({ apiKey: key });
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 320,
      messages: [
        {
          role: "system",
          content:
            "You write concise, factual data-PR pitches for football journalists. No hype, no clichés, no fabricated quotes. 90-130 words. Plain text, ready for the user to edit and send.",
        },
        {
          role: "user",
          content: `Draft a pitch email offering this original data study as a citable source.\n\nStudy: "${study.title}"\nSummary: ${study.dek}\nTop 5:\n${top5}\n\nMethodology: ${study.data.methodology}\nLink: ${url}\n\nInclude a short subject line, one sentence on why it's newsworthy now, the headline stat, and the link. Make clear the data is free to cite with attribution to DataSports.`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("[studies] pitch draft failed:", err);
    return null;
  }
}
