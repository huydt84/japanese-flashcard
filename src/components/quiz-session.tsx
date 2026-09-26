"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "@phosphor-icons/react";
import type { QuizQuestion } from "@/lib/lesson-study";
import type { StudyDirection } from "@/lib/types";
import { VocabularyEntry } from "./vocabulary-entry";

type Props = {
  lessonTitle: string;
  questions: QuizQuestion[];
  direction: StudyDirection;
  preview: boolean;
  onExit: () => void;
  onConfigure: () => void;
};

type QuizState = { kind: "question"; index: number; answers: string[] } | { kind: "results"; answers: string[] };

export function QuizSession({ lessonTitle, questions, direction, preview, onExit, onConfigure }: Props) {
  const [state, setState] = useState<QuizState>({ kind: "question", index: 0, answers: [] });
  const heading = useRef<HTMLHeadingElement>(null);
  const index = state.kind === "question" ? state.index : questions.length;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);

  if (state.kind === "results") {
    const correct = questions.filter((question, i) => state.answers[i] === question.answer).length;
    return (
      <section className="mx-auto max-w-4xl pb-10">
        <button type="button" className="quiet-link inline-flex min-h-11 items-center gap-2" onClick={onExit}><ArrowLeft aria-hidden="true" />Quay lại bài học</button>
        <header className="py-8">
          <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-[-.03em]">Kết quả trắc nghiệm</h1>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{correct} / {questions.length} câu đúng</p>
          <p className="mt-2 text-muted">{preview ? "Xem thử, không lưu kết quả." : "Kết quả luyện tập không thay đổi lịch ôn."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={onConfigure}>Làm bài mới</button>
            <button type="button" className="button-secondary" onClick={onExit}>Quay lại bài học</button>
          </div>
        </header>
        <h2 className="mb-2 text-xl font-bold">Xem lại câu trả lời</h2>
        <ol className="divide-y divide-line border-t border-line">
          {questions.map((question, i) => {
            const right = state.answers[i] === question.answer;
            return <li key={question.card.id} className="py-6">
              <p className={`mb-4 flex items-center gap-2 text-sm font-bold ${right ? "text-correct-ink" : "text-wrong-ink"}`}>{right ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{right ? "Đúng" : "Chưa đúng"}<span className="font-normal text-muted">Câu {i + 1}</span></p>
              {!right && <p className="mb-4 break-words text-sm">Bạn chọn: <span className={direction === "back-first" ? "font-jp" : ""}>{state.answers[i]}</span></p>}
              <VocabularyEntry card={question.card} />
            </li>;
          })}
        </ol>
      </section>
    );
  }

  const question = questions[state.index];
  const selected = state.answers[state.index];
  const answered = selected !== undefined;
  const correct = selected === question.answer;

  function answer(option: string) {
    setState((previous) => previous.kind !== "question" || previous.answers[previous.index] !== undefined ? previous : { ...previous, answers: [...previous.answers, option] });
  }

  function next() {
    if (!answered) return;
    setState((previous) => {
      if (previous.kind !== "question" || previous.answers[previous.index] === undefined) return previous;
      return previous.index + 1 === questions.length ? { kind: "results", answers: previous.answers } : { ...previous, index: previous.index + 1 };
    });
    window.scrollTo(0, 0);
  }

  return (
    <section className="mx-auto max-w-3xl pb-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button type="button" className="quiet-link inline-flex min-h-11 items-center gap-2 text-sm" onClick={onExit}><ArrowLeft aria-hidden="true" />Quay lại bài học</button>
          <p className="mt-2 break-words font-semibold">{lessonTitle}</p>
          <p className="mt-1 text-sm text-muted">{preview ? "Xem thử · Không lưu kết quả" : "Trắc nghiệm · Không thay đổi lịch ôn"}</p>
        </div>
        <p className="shrink-0 pt-3 text-sm font-bold tabular-nums">{state.index + 1} / {questions.length}</p>
      </header>
      <div className="my-8 rounded-2xl bg-surface-strong px-6 py-10 paper-shadow sm:px-10 sm:py-14">
        <p className="text-sm font-semibold text-muted">{direction === "front-first" ? "Chọn nghĩa tiếng Việt" : "Chọn từ Kanji"}</p>
        <h1 ref={heading} tabIndex={-1} lang={direction === "front-first" ? "ja" : "vi"} className={`mt-6 break-words text-4xl font-semibold leading-relaxed sm:text-5xl ${direction === "front-first" ? "font-jp" : ""}`}>{question.prompt}</h1>
      </div>
      <div role="group" aria-label="Các đáp án" className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const isCorrect = answered && option === question.answer;
          const isWrong = answered && selected === option && !isCorrect;
          return <button key={option} type="button" onClick={() => answer(option)} aria-disabled={answered} className={`quiz-option flex min-h-16 items-center gap-4 rounded-xl border p-4 text-left ${isCorrect ? "border-correct bg-correct/10" : isWrong ? "border-wrong bg-wrong/10" : "border-line bg-surface-strong"}`}>
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold">{isCorrect ? <Check className="text-correct" /> : isWrong ? <X className="text-wrong" /> : String.fromCharCode(65 + i)}</span>
            <span className={`min-w-0 break-words font-semibold ${direction === "back-first" ? "font-jp text-xl" : ""}`}>{option}</span>
            {isCorrect && <span className="sr-only">, đáp án đúng</span>}{isWrong && <span className="sr-only">, bạn đã chọn, chưa đúng</span>}
          </button>;
        })}
      </div>
      {answered && <section className="mt-8 border-t border-line pt-6" aria-label="Giải thích đáp án">
        <p role="status" className={`mb-5 flex items-center gap-2 font-bold ${correct ? "text-correct-ink" : "text-wrong-ink"}`}>{correct ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{correct ? "Chính xác!" : `Chưa đúng. Đáp án: ${question.answer}`}</p>
        <VocabularyEntry card={question.card} />
        <div className="mt-6 flex justify-end"><button type="button" className="button-primary" onClick={next}>{state.index + 1 === questions.length ? "Xem kết quả" : "Tiếp theo"}<ArrowRight aria-hidden="true" /></button></div>
      </section>}
    </section>
  );
}
