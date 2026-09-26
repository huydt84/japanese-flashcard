import { describe, expect, it } from "vitest";
import { buildQuizQuestions, quizCandidates, selectSessionCards } from "./lesson-study";
import type { StudyCard, StudyDirection } from "./types";

const card = (id: string, kanji: string, meaning_vi: string): StudyCard => ({ id, kanji, meaning_vi, hiragana: "かな", example_ja: "例文。", example_vi: "Ví dụ." });

describe("quiz question eligibility", () => {
  it.each<StudyDirection>(["front-first", "back-first"])("excludes ambiguous and repeated prompts in %s, including ambiguity outside the selected scope", (direction) => {
    const cards = [card("one", "学ぶ", "học"), card("duplicate", " 学ぶ ", "HỌC"), card("ambiguous", "学ぶ", "học hỏi"), card("two", "食べる", "ăn"), card("three", "飲む", "uống")];
    const deck = direction === "front-first" ? cards : cards.map((item) => ({ ...item, kanji: item.meaning_vi, meaning_vi: item.kanji }));
    expect(quizCandidates(deck, direction, new Set(["one", "two"])).map((item) => item.id)).toEqual(["two"]);
    expect(quizCandidates([deck[0], deck[1], deck[3]], direction).map((item) => item.id)).toEqual(["one", "two"]);
    expect(quizCandidates([deck[0], deck[1], deck[3]], direction, new Set(["duplicate"])).map((item) => item.id)).toEqual(["duplicate"]);
  });

  it("cannot quiz a lesson with only one distinct answer", () => {
    expect(quizCandidates([card("one", "学ぶ", "học"), card("two", "習う", " HỌC ")], "front-first")).toEqual([]);
  });
});

it.each([2, 3, 6])("builds distinct choices with exactly one correct answer from a %s-answer lesson", (size) => {
  const cards = Array.from({ length: size }, (_, i) => card(String(i), `単語${i}`, `nghĩa ${i}`));
  const question = buildQuizQuestions([cards[0]], [...cards, { ...cards[1], id: "repeat" }], "front-first")[0];
  expect(question.prompt).toBe("単語0");
  expect(question.options).toHaveLength(Math.min(4, size));
  expect(new Set(question.options).size).toBe(question.options.length);
  expect(question.options.filter((option) => option === "nghĩa 0")).toHaveLength(1);
  expect(question.options.every((option) => cards.some((item) => item.meaning_vi === option))).toBe(true);
});

it("selects the requested count without changing teacher order or the source deck", () => {
  const cards = [card("one", "学ぶ", "học"), card("two", "食べる", "ăn"), card("three", "飲む", "uống")];
  const config = { direction: "front-first", scope: "all", count: 2, shuffle: false } as const;
  expect(selectSessionCards(cards, config).map((item) => item.id)).toEqual(["one", "two"]);
  const shuffled = selectSessionCards(cards, { ...config, count: "all", shuffle: true });
  expect(shuffled.map((item) => item.id).sort()).toEqual(["one", "three", "two"]);
  expect(cards.map((item) => item.id)).toEqual(["one", "two", "three"]);
  const reverse = buildQuizQuestions([cards[0]], cards, "back-first")[0];
  expect(reverse.prompt).toBe("học");
  expect(reverse.answer).toBe("学ぶ");
});
