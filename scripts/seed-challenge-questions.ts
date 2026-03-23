/**
 * Seed challenge trivia questions using GPT-4o-mini
 *
 * Usage:
 *   OPENAI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/seed-challenge-questions.ts
 *   OPENAI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/seed-challenge-questions.ts --days=14
 *   OPENAI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/seed-challenge-questions.ts --pool-only
 */

import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const CATEGORIES = ["history", "stats", "transfers", "rules", "geography"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const QUESTIONS_PER_DAY = 5;

const args = process.argv.slice(2);
const daysFlag = args.find((a) => a.startsWith("--days="));
const days = daysFlag ? parseInt(daysFlag.split("=")[1]) : 7;
const poolOnly = args.includes("--pool-only");

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
}

async function generateBatch(
  category: string,
  count: number
): Promise<GeneratedQuestion[]> {
  const prompt = `Generate ${count} football (soccer) trivia questions in the "${category}" category.

Category guidelines:
- history: historic events, records, famous matches, World Cup history, legendary players
- stats: statistical records, goal scoring records, appearances, transfer fees
- transfers: famous transfers, record deals, notable free agents, loan moves
- rules: Laws of the Game, VAR, offside rule, penalty rules, substitution rules
- geography: where teams are based, stadium locations, football geography

Requirements:
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one correct answer per question
- Mix difficulty levels: some easy, some medium, some hard
- Questions should be about real football facts
- Options should be plausible (no obviously wrong answers)
- Keep questions concise (under 120 characters)
- Keep options concise (under 60 characters each)

Return a JSON array of objects with this exact structure:
[
  {
    "question": "Which team won the first Premier League title in 1992-93?",
    "options": ["Manchester United", "Arsenal", "Liverpool", "Blackburn Rovers"],
    "correctIndex": 0,
    "difficulty": "easy"
  }
]

Return ONLY the JSON array, no markdown or explanation.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 4000,
    temperature: 0.8,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  // Parse JSON (handle possible markdown wrapping)
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const questions: GeneratedQuestion[] = JSON.parse(jsonStr);

  // Validate and tag
  return questions
    .filter(
      (q) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
    )
    .map((q) => ({
      ...q,
      category,
      difficulty: DIFFICULTIES.includes(q.difficulty as any)
        ? q.difficulty
        : "medium",
    }));
}

async function main() {
  const totalQuestions = poolOnly
    ? QUESTIONS_PER_DAY * days
    : QUESTIONS_PER_DAY * days;

  console.log(
    `Generating ${totalQuestions} questions (${days} days × ${QUESTIONS_PER_DAY}/day)...`
  );

  const allQuestions: GeneratedQuestion[] = [];

  // Generate questions per category to ensure variety
  const perCategory = Math.ceil(totalQuestions / CATEGORIES.length);

  for (const category of CATEGORIES) {
    console.log(`  Generating ${perCategory} "${category}" questions...`);
    try {
      const questions = await generateBatch(category, perCategory);
      allQuestions.push(...questions);
      console.log(`    Got ${questions.length} valid questions`);
    } catch (err) {
      console.error(`    Error generating ${category}:`, err);
    }
  }

  if (allQuestions.length === 0) {
    console.error("No questions generated. Exiting.");
    process.exit(1);
  }

  // Shuffle questions
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  // Assign dates if not pool-only
  const today = new Date();
  let inserted = 0;

  if (poolOnly) {
    // Insert all as pool (activeDate = null)
    for (const q of allQuestions) {
      await sql`
        INSERT INTO challenge_questions (question, options, correct_index, category, difficulty, active_date)
        VALUES (${q.question}, ${JSON.stringify(q.options)}::jsonb, ${q.correctIndex}, ${q.category}, ${q.difficulty}, NULL)
      `;
      inserted++;
    }
    console.log(`\nInserted ${inserted} pool questions (no date assigned)`);
  } else {
    // Assign 5 per day starting from tomorrow
    for (let d = 0; d < days; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d + 1);
      const dateStr = date.toISOString().split("T")[0];

      const dayQuestions = allQuestions.slice(
        d * QUESTIONS_PER_DAY,
        (d + 1) * QUESTIONS_PER_DAY
      );

      for (const q of dayQuestions) {
        if (!q) continue;
        await sql`
          INSERT INTO challenge_questions (question, options, correct_index, category, difficulty, active_date)
          VALUES (${q.question}, ${JSON.stringify(q.options)}::jsonb, ${q.correctIndex}, ${q.category}, ${q.difficulty}, ${dateStr})
        `;
        inserted++;
      }
      console.log(`  ${dateStr}: ${dayQuestions.length} questions assigned`);
    }
    console.log(`\nInserted ${inserted} questions across ${days} days`);
  }

  // Show stats
  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE active_date IS NULL) as pool,
      COUNT(*) FILTER (WHERE active_date IS NOT NULL) as assigned,
      COUNT(DISTINCT active_date) FILTER (WHERE active_date IS NOT NULL) as days_covered
    FROM challenge_questions
  `;
  console.log("\nDatabase stats:");
  console.log(`  Pool questions: ${stats[0].pool}`);
  console.log(`  Assigned questions: ${stats[0].assigned}`);
  console.log(`  Days covered: ${stats[0].days_covered}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
