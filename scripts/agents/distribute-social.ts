/**
 * Marketing AI Agent — Layer 3: Distribute to Social
 *
 * Reads recently published articles and generates short social post text
 * using OpenAI API. Saves to social_posts table and data/social-queue/.
 * Does NOT actually post — output is for manual review.
 *
 * Usage:
 *   npx tsx scripts/agents/distribute-social.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sportsdb.com";

interface RecentArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: string;
}

async function getRecentArticles(): Promise<RecentArticle[]> {
  return await sql`
    SELECT id, slug, title, excerpt, type
    FROM articles
    WHERE status = 'published'
      AND published_at >= NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM social_posts sp
        WHERE sp.link_url LIKE '%' || articles.slug || '%'
      )
    ORDER BY published_at DESC
    LIMIT 10
  `;
}

function buildSocialPrompt(article: RecentArticle): string {
  return `You are a social media manager for a football database website.

Write a short, engaging Twitter/X post (max 260 characters) to promote this article. Include relevant hashtags (2-3 max). Do NOT include the link — it will be appended automatically.

Article title: ${article.title}
Article type: ${article.type}
Excerpt: ${article.excerpt}

Return ONLY the post text, nothing else.`;
}

async function generateSocialPost(article: RecentArticle): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [{ role: "user", content: buildSocialPrompt(article) }],
    });

    const text = response.choices[0]?.message?.content || "";
    return text.trim().slice(0, 280) || null;
  } catch (error) {
    console.error(`  OpenAI API error for "${article.title}":`, error);
    return null;
  }
}

async function saveSocialPost(article: RecentArticle, postText: string) {
  const linkUrl = `${SITE_URL}/news/${article.slug}`;

  await sql`
    INSERT INTO social_posts (platform, content, link_url)
    VALUES ('twitter', ${postText}, ${linkUrl})
  `;

  const queueDir = join(process.cwd(), "data", "social-queue");
  mkdirSync(queueDir, { recursive: true });

  const filename = `${article.slug}-${Date.now()}.json`;
  writeFileSync(
    join(queueDir, filename),
    JSON.stringify(
      {
        platform: "twitter",
        articleSlug: article.slug,
        articleTitle: article.title,
        postText,
        linkUrl,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  return filename;
}

async function logAction(action: string, input: string, output: string) {
  await sql`
    INSERT INTO agent_logs (agent_layer, action, input, output)
    VALUES ('distribute', ${action}, ${input}, ${output})
  `;
}

async function main() {
  console.log("Agent Layer 3: Distribute to Social");
  console.log("=====================================\n");

  const articles = await getRecentArticles();
  console.log(`Found ${articles.length} recent articles without social posts\n`);

  if (articles.length === 0) {
    console.log("No new articles to distribute.");
    await logAction("distribute_check", "last 24h", "0 articles found");
    return;
  }

  let created = 0;

  for (const article of articles) {
    console.log(`Generating post for: "${article.title}"`);
    const postText = await generateSocialPost(article);

    if (postText) {
      const filename = await saveSocialPost(article, postText);
      console.log(`  Saved: ${filename}`);
      console.log(`  Post: ${postText.slice(0, 80)}...`);
      await logAction("generate_social_post", article.slug, postText);
      created++;
    } else {
      console.log("  Skipped — generation failed");
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nCreated ${created}/${articles.length} social posts`);
  await logAction("distribute_run_complete", `${articles.length} articles`, `${created} posts`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
