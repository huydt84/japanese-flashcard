import type { StudyCard, StudyConfiguration, StudyDirection } from "./types";

export type QuizQuestion = {
  card: StudyCard;
  prompt: string;
  answer: string;
  options: string[];
};

function normalized(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

function pair(card: StudyCard, direction: StudyDirection) {
  return direction === "front-first"
    ? { prompt: card.kanji, answer: card.meaning_vi }
    : { prompt: card.meaning_vi, answer: card.kanji };
}

function answersFor(cards: StudyCard[], direction: StudyDirection) {
  const answers = new Map<string, string>();
  for (const card of cards) {
    const { answer } = pair(card, direction);
    if (normalized(answer)) answers.set(normalized(answer), answer);
  }
  return answers;
}

// Check ambiguity against the entire lesson, even when only due cards are selected.
export function quizCandidates(cards: StudyCard[], direction: StudyDirection, allowedIds?: Set<string>) {
  if (answersFor(cards, direction).size < 2) return [];
  const prompts = new Map<string, Set<string>>();
  for (const card of cards) {
    const { prompt, answer } = pair(card, direction);
    const key = normalized(prompt);
    const answers = prompts.get(key) ?? new Set<string>();
    answers.add(normalized(answer));
    prompts.set(key, answers);
  }
  const seen = new Set<string>();
  return cards.filter((card) => {
    const { prompt, answer } = pair(card, direction);
    const key = normalized(prompt);
    if (!key || !normalized(answer) || prompts.get(key)?.size !== 1 || seen.has(key) || (allowedIds && !allowedIds.has(card.id))) return false;
    seen.add(key);
    return true;
  });
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
}

export function selectSessionCards(cards: StudyCard[], config: StudyConfiguration) {
  const ordered = config.shuffle ? shuffled(cards) : [...cards];
  return config.count === "all" ? ordered : ordered.slice(0, config.count);
}

export function buildQuizQuestions(selected: StudyCard[], allCards: StudyCard[], direction: StudyDirection): QuizQuestion[] {
  const answers = answersFor(allCards, direction);
  return selected.map((card) => {
    const { prompt, answer } = pair(card, direction);
    const alternatives = [...answers.entries()].filter(([key]) => key !== normalized(answer)).map(([, text]) => text);
    return { card, prompt, answer, options: shuffled([answer, ...shuffled(alternatives).slice(0, 3)]) };
  });
}
