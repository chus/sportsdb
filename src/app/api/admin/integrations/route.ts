import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const integrations = [
  {
    name: "Stripe",
    envVar: "STRIPE_SECRET_KEY",
    description: "Payment processing for subscriptions",
  },
  {
    name: "Football-Data.org",
    envVar: "FOOTBALL_DATA_API_KEY",
    description: "Match data, standings, and competition info",
  },
  {
    name: "API-Football",
    envVar: "API_FOOTBALL_KEY",
    description: "Extended match events, lineups, and statistics",
  },
  {
    name: "Google OAuth",
    envVar: "GOOGLE_CLIENT_ID",
    description: "Social login via Google accounts",
  },
  {
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    description: "AI-generated articles and content",
  },
];

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const services = integrations.map((integration) => ({
      name: integration.name,
      description: integration.description,
      configured: !!process.env[integration.envVar],
    }));

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Admin integrations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
