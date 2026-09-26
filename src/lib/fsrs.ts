import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { ReviewRating } from "@/lib/types";

export const scheduler = fsrs({
  request_retention: 0.9,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

export const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

export function nextReview(stored: Partial<Card> | null, rating: ReviewRating, now = new Date()) {
  const card = stored ? ({ ...createEmptyCard(now), ...stored } as Card) : createEmptyCard(now);
  return scheduler.next(card, now, ratingMap[rating]);
}
