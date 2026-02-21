import OpenAI from "openai";
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

const MODEL_VERSION = "gpt-3.5-turbo";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI();
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
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: MODEL_VERSION,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildMatchPrompt(matchData),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  const response = parseJsonResponse<MatchSummaryResponse>(content);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export async function generatePlayerSummary(
  playerData: PlayerMatchContext
): Promise<{ response: PlayerSummaryResponse; modelVersion: string }> {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: MODEL_VERSION,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: buildPlayerPrompt(playerData),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  const response = parseJsonResponse<PlayerSummaryResponse>(content);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export async function generateTournamentSummary(
  tournamentData: TournamentContext
): Promise<{ response: TournamentSummaryResponse; modelVersion: string }> {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: MODEL_VERSION,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildTournamentPrompt(tournamentData),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  const response = parseJsonResponse<TournamentSummaryResponse>(content);

  return {
    response,
    modelVersion: MODEL_VERSION,
  };
}

export { MODEL_VERSION };
