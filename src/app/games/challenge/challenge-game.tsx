"use client";

import { useState } from "react";
import { Trophy, Lock, CheckCircle, XCircle, Brain } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAnalytics } from "@/hooks/use-analytics";

interface Question {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
  imageUrl: string | null;
}

interface Progress {
  totalQuestions: number;
  answered: number;
  correct: number;
  points: number;
  isComplete: boolean;
  answers: {
    questionId: string;
    selectedIndex: number;
    isCorrect: boolean;
    points: number;
  }[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  correctAnswers: number;
  totalAnswers: number;
}

interface ChallengeGameProps {
  questions: Question[];
  progress: Progress | null;
  leaderboard: LeaderboardEntry[];
  isLoggedIn: boolean;
}

export function ChallengeGame({
  questions,
  progress,
  leaderboard,
  isLoggedIn,
}: ChallengeGameProps) {
  const { canAccess } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { track } = useAnalytics();
  const isPro = canAccess("games");

  const [answers, setAnswers] = useState<
    Record<string, { selectedIndex: number; isCorrect: boolean; points: number }>
  >(() => {
    const initial: Record<string, { selectedIndex: number; isCorrect: boolean; points: number }> = {};
    if (progress) {
      for (const a of progress.answers) {
        initial[a.questionId] = {
          selectedIndex: a.selectedIndex,
          isCorrect: a.isCorrect,
          points: a.points,
        };
      }
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handleAnswer = async (questionId: string, selectedIndex: number) => {
    if (!isLoggedIn) return;
    if (answers[questionId]) return; // Already answered

    if (!isPro) {
      track({ eventType: "upgrade_impression", metadata: { feature: "games_challenge", context: "challenge_locked" } });
      openUpgradeModal("games_challenge", "challenge_locked");
      return;
    }

    setSubmitting(questionId);
    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedIndex }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnswers((prev) => ({
          ...prev,
          [questionId]: {
            selectedIndex: data.selectedIndex,
            isCorrect: data.isCorrect,
            points: data.points,
          },
        }));
      } else {
        const data = await res.json();
        if (data.upgradeUrl) {
          openUpgradeModal("games_challenge", "challenge_api_gate");
        }
      }
    } finally {
      setSubmitting(null);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const totalPoints = Object.values(answers).reduce((sum, a) => sum + a.points, 0);

  const difficultyColor = (d: string) =>
    d === "hard"
      ? "text-red-600 bg-red-50"
      : d === "medium"
      ? "text-orange-600 bg-orange-50"
      : "text-green-600 bg-green-50";

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {/* Progress bar */}
        {questions.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">
                {answeredCount}/{questions.length} answered
              </span>
              <span className="text-sm font-bold text-neutral-900">
                {totalPoints} pts
              </span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                style={{
                  width: `${
                    questions.length > 0
                      ? (answeredCount / questions.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {questions.length === 0 && (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">
              No questions available today. Check back tomorrow!
            </p>
          </div>
        )}

        {/* Questions */}
        {questions.map((q, idx) => {
          const answer = answers[q.id];
          const isAnswered = !!answer;

          return (
            <div
              key={q.id}
              className="bg-white rounded-xl border border-neutral-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-neutral-400">
                  Question {idx + 1}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColor(q.difficulty)}`}
                >
                  {q.difficulty}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                {q.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((option, optIdx) => {
                  const isSelected = answer?.selectedIndex === optIdx;
                  const isCorrectAnswer = isAnswered && answer.isCorrect && isSelected;
                  const isWrongAnswer = isAnswered && !answer.isCorrect && isSelected;

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleAnswer(q.id, optIdx)}
                      disabled={isAnswered || submitting === q.id}
                      className={`relative p-4 rounded-lg text-left text-sm font-medium transition-all border ${
                        isCorrectAnswer
                          ? "bg-green-50 border-green-300 text-green-800"
                          : isWrongAnswer
                          ? "bg-red-50 border-red-300 text-red-800"
                          : isAnswered
                          ? "bg-neutral-50 border-neutral-200 text-neutral-400"
                          : !isPro
                          ? "bg-neutral-50 border-neutral-200 text-neutral-500 cursor-not-allowed"
                          : "bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-purple-300 hover:bg-purple-50"
                      }`}
                    >
                      {!isPro && !isAnswered && (
                        <Lock className="absolute top-3 right-3 w-3.5 h-3.5 text-neutral-400" />
                      )}
                      {isCorrectAnswer && (
                        <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-green-500" />
                      )}
                      {isWrongAnswer && (
                        <XCircle className="absolute top-3 right-3 w-4 h-4 text-red-500" />
                      )}
                      {option}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="mt-3 text-sm text-neutral-500">
                  {answer.isCorrect
                    ? `Correct! +${answer.points} points`
                    : "Incorrect"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar: Leaderboard */}
      <div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5 sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold text-neutral-900">Challenge Leaderboard</h3>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">
              No answers yet.
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-neutral-400 font-mono text-xs">
                      {entry.rank}
                    </span>
                    <span className="font-medium text-neutral-900 truncate max-w-[140px]">
                      {entry.userName}
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900">
                    {entry.totalPoints} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
