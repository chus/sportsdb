import Anthropic from "@anthropic-ai/sdk";
import type {
  MatchContext,
  MatchSummaryResponse,
  PlayerMatchContext,
  PlayerSummaryResponse,
  TournamentContext,
  TournamentSummaryResponse,
} from "./types";
import {
  buildMatchPrompt,
  buildPlayerPrompt,
  buildTournamentPrompt,
} from "./prompts";

const MODEL_VERSION = "claude-sonnet-4-20250514";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

function parseJsonResponse<T>(content: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr) as T;
}

export async function generateMatchSummary(
  matchData: MatchContext
): Promise<{ response: MatchSummaryResponse; modelVersion: string }> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL_VERSION,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildMatchPrompt(matchData),
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  const response = parseJsonResponse<MatchSummaryResponse>(textContent.text);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export async function generatePlayerSummary(
  playerData: PlayerMatchContext
): Promise<{ response: PlayerSummaryResponse; modelVersion: string }> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL_VERSION,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: buildPlayerPrompt(playerData),
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  const response = parseJsonResponse<PlayerSummaryResponse>(textContent.text);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export async function generateTournamentSummary(
  tournamentData: TournamentContext
): Promise<{ response: TournamentSummaryResponse; modelVersion: string }> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL_VERSION,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildTournamentPrompt(tournamentData),
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  const response = parseJsonResponse<TournamentSummaryResponse>(textContent.text);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export { MODEL_VERSION };
