import { describe, expect, it } from "vitest";
import { nextReview, ratingMap } from "@/lib/fsrs";
import { Rating } from "ts-fsrs";

describe("FSRS review mapping", () => {
  it("maps the three visible ratings", () => {
    expect(ratingMap).toEqual({ again: Rating.Again, hard: Rating.Hard, good: Rating.Good });
  });

  it("schedules a new card after a review", () => {
    const now = new Date("2026-09-16T08:00:00.000Z");
    const result = nextReview(null, "good", now);
    expect(result.card.reps).toBe(1);
    expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("puts Again no later than Good", () => {
    const now = new Date("2026-09-16T08:00:00.000Z");
    expect(nextReview(null, "again", now).card.due.getTime()).toBeLessThanOrEqual(nextReview(null, "good", now).card.due.getTime());
  });
});

