import { describe, expect, it } from "vitest";
import { nextReview } from "@/lib/fsrs";

describe("FSRS review mapping", () => {
  it("schedules a new card after a review", () => {
    const now = new Date("2026-09-16T08:00:00.000Z");
    const result = nextReview(null, "good", now);
    expect(result.card.reps).toBe(1);
    expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("schedules Again before Hard before Good for a new card", () => {
    const now = new Date("2026-09-16T08:00:00.000Z");
    const again = nextReview(null, "again", now).card.due.getTime();
    const hard = nextReview(null, "hard", now).card.due.getTime();
    const good = nextReview(null, "good", now).card.due.getTime();
    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
  });
});
