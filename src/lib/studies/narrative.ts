import OpenAI from "openai";
import type { Study } from "./generators";

/**
 * A short, tightly-grounded analyst narrative for a study — the readable
 * "engaging" layer on top of the deterministic data. Constrained HARD to the
 * computed facts (insights + top rows): the model may only rephrase what it's
 * given, never introduce a number, name or claim. Low temperature. Returns
 * null without an OpenAI key. Kept to 2-3 sentences so the page stays
 * data-dominant (data-grounded + minimal prose = low AI-content SEO risk).
 */
export async function draftNarrative(study: Study): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const top5 = study.data.rows
    .slice(0, 5)
    .map((r) => `${r.rank}. ${r.player}${r.team ? ` (${r.team})` : ""} — ${Object.entries(r.values).map(([k, v]) => `${k}: ${v}`).join(", ")}`)
    .join("\n");
  const facts = (study.data.insights ?? []).map((i) => `- ${i}`).join("\n");

  try {
    const openai = new OpenAI({ apiKey: key });
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content:
            "You are a football data analyst writing a 2-3 sentence intro for a data study. STRICT RULES: use ONLY the facts provided; never invent or infer any number, name, team, or claim not explicitly given; no hype, no predictions, no clichés. If a fact isn't provided, don't state it. Neutral, precise analyst tone. Plain text.",
        },
        {
          role: "user",
          content: `Study: "${study.title}"\nHeadline: ${study.dek}\n\nVerified findings (use only these):\n${facts}\n\nTop 5 rows:\n${top5}\n\nWrite the 2-3 sentence intro.`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.warn("[studies] narrative draft failed:", err);
    return null;
  }
}
