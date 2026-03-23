import { db } from "@/lib/db";
import { challengeQuestions, challengeAnswers, users } from "@/lib/db/schema";
import { eq, and, desc, count, sum, sql } from "drizzle-orm";

export interface ChallengeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
  imageUrl: string | null;
}

export interface ChallengeAnswer {
  id: string;
  userId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  points: number;
  answeredAt: Date | null;
}

// Get today's challenge questions
export async function getDailyQuestions(): Promise<ChallengeQuestion[]> {
  const today = new Date().toISOString().split("T")[0];

  const results = await db
    .select()
    .from(challengeQuestions)
    .where(eq(challengeQuestions.activeDate, today))
    .orderBy(challengeQuestions.id);

  return results.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options as string[],
    correctIndex: q.correctIndex,
    category: q.category,
    difficulty: q.difficulty,
    imageUrl: q.imageUrl,
  }));
}

// Submit a challenge answer
export async function submitChallengeAnswer(
  userId: string,
  questionId: string,
  selectedIndex: number
): Promise<ChallengeAnswer> {
  const [question] = await db
    .select()
    .from(challengeQuestions)
    .where(eq(challengeQuestions.id, questionId))
    .limit(1);

  if (!question) throw new Error("Question not found");

  // Verify question is for today
  const today = new Date().toISOString().split("T")[0];
  if (question.activeDate !== today) {
    throw new Error("This question is not active today");
  }

  const isCorrect = selectedIndex === question.correctIndex;
  const points = isCorrect
    ? question.difficulty === "hard"
      ? 3
      : question.difficulty === "medium"
      ? 2
      : 1
    : 0;

  const [result] = await db
    .insert(challengeAnswers)
    .values({ userId, questionId, selectedIndex, isCorrect, points })
    .onConflictDoUpdate({
      target: [challengeAnswers.userId, challengeAnswers.questionId],
      set: { selectedIndex, isCorrect, points, answeredAt: new Date() },
    })
    .returning();

  return {
    id: result.id,
    userId: result.userId,
    questionId: result.questionId,
    selectedIndex: result.selectedIndex,
    isCorrect: result.isCorrect,
    points: result.points,
    answeredAt: result.answeredAt,
  };
}

// Get user's progress for today's challenge
export async function getUserDailyProgress(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const results = await db
    .select({
      answer: challengeAnswers,
      questionId: challengeQuestions.id,
    })
    .from(challengeQuestions)
    .leftJoin(
      challengeAnswers,
      and(
        eq(challengeAnswers.questionId, challengeQuestions.id),
        eq(challengeAnswers.userId, userId)
      )
    )
    .where(eq(challengeQuestions.activeDate, today));

  const totalQuestions = results.length;
  const answered = results.filter((r) => r.answer !== null).length;
  const correct = results.filter((r) => r.answer?.isCorrect === true).length;
  const points = results.reduce(
    (sum, r) => sum + (r.answer?.points ?? 0),
    0
  );

  return {
    totalQuestions,
    answered,
    correct,
    points,
    isComplete: answered === totalQuestions && totalQuestions > 0,
    answers: results
      .filter((r) => r.answer !== null)
      .map((r) => ({
        questionId: r.questionId,
        selectedIndex: r.answer!.selectedIndex,
        isCorrect: r.answer!.isCorrect,
        points: r.answer!.points,
      })),
  };
}

// Get challenge leaderboard
export async function getChallengeLeaderboard(limit = 50) {
  const results = await db
    .select({
      userId: challengeAnswers.userId,
      userName: users.name,
      totalPoints: sum(challengeAnswers.points),
      correctAnswers: sql<number>`COUNT(*) FILTER (WHERE ${challengeAnswers.isCorrect} = true)`,
      totalAnswers: count(),
    })
    .from(challengeAnswers)
    .innerJoin(users, eq(challengeAnswers.userId, users.id))
    .groupBy(challengeAnswers.userId, users.name)
    .orderBy(desc(sum(challengeAnswers.points)))
    .limit(limit);

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    userName: r.userName ?? "Anonymous",
    totalPoints: Number(r.totalPoints ?? 0),
    correctAnswers: Number(r.correctAnswers ?? 0),
    totalAnswers: Number(r.totalAnswers ?? 0),
  }));
}
