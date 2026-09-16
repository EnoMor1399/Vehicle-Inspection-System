export type TrainingCompositeScores = {
  theoryScore: number;
  roadSignScore: number;
  assessmentPerformanceScore: number;
};

export type TrainingCompositeClassification =
  | "excellent"
  | "very_good"
  | "satisfactory"
  | "needs_improvement"
  | "unsatisfactory";

export function normalizePercentageScore(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Scores must be between 0 and 100");
  }
  return Math.round(value * 100) / 100;
}

export function calculateTrainingCompositeScore(scores: TrainingCompositeScores) {
  const theoryScore = normalizePercentageScore(scores.theoryScore);
  const roadSignScore = normalizePercentageScore(scores.roadSignScore);
  const assessmentPerformanceScore = normalizePercentageScore(scores.assessmentPerformanceScore);

  return Math.round(((theoryScore + roadSignScore + assessmentPerformanceScore) / 3) * 100) / 100;
}

export function classifyTrainingCompositeScore(score: number): TrainingCompositeClassification {
  const value = normalizePercentageScore(score);
  if (value >= 90) return "excellent";
  if (value >= 80) return "very_good";
  if (value >= 70) return "satisfactory";
  if (value >= 60) return "needs_improvement";
  return "unsatisfactory";
}

export function calculateAssessmentPerformanceScore(scoredPoints: number | null | undefined, maximumPoints: number | null | undefined) {
  if (typeof scoredPoints !== "number" || typeof maximumPoints !== "number" || maximumPoints <= 0) return null;
  const score = (scoredPoints / maximumPoints) * 100;
  return normalizePercentageScore(score);
}
