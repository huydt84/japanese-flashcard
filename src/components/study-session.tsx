"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowCounterClockwise, Check, QuestionMark, X } from "@phosphor-icons/react";
import Link from "next/link";
import { submitReview, undoReview } from "@/app/actions";
import type { ReviewRating, StudyCard } from "@/lib/types";

const actions = [
  { rating: null, label: "Hoàn tác", key: "U", Icon: ArrowCounterClockwise, tone: "text-muted" },
  { rating: "again" as const, label: "Sai", key: "1", Icon: X, tone: "text-wrong" },
  { rating: "hard" as const, label: "Chưa chắc", key: "2", Icon: QuestionMark, tone: "text-unsure" },
  { rating: "good" as const, label: "Đúng", key: "3", Icon: Check, tone: "text-correct" },
];

type StudySessionProps = {
  mode: "study" | "preview";
  lessonTitle: string;
  cards: StudyCard[];
  backHref: string;
};

export function StudySession({ mode, lessonTitle, cards, backHref }: StudySessionProps) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [last, setLast] = useState<StudyCard | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const sessionId = useMemo(() => mode === "study" ? crypto.randomUUID() : null, [mode]);
  const total = cards.length;
  const current = queue[0];
  const completed = total - queue.length;

  const grade = useCallback((rating: ReviewRating) => {
    if (!current || !flipped || pending) return;
    setError("");

    if (mode === "preview") {
      setLast(current);
      setQueue((items) => items.slice(1));
      setFlipped(false);
      return;
    }

    startTransition(async () => {
      try {
        await submitReview(current.id, sessionId!, rating);
        setLast(current);
        setQueue((items) => items.slice(1));
        setFlipped(false);
      } catch {
        setError("Không thể lưu câu trả lời. Hãy kiểm tra kết nối và thử lại.");
      }
    });
  }, [current, flipped, mode, pending, sessionId]);

  const undo = useCallback(() => {
    if (!last || pending) return;
    setError("");

    if (mode === "preview") {
      setQueue((items) => [last, ...items]);
      setLast(null);
      setFlipped(true);
      return;
    }

    startTransition(async () => {
      try {
        await undoReview(sessionId!);
        setQueue((items) => [last, ...items]);
        setLast(null);
        setFlipped(true);
      } catch {
        setError("Không thể hoàn tác câu trả lời gần nhất.");
      }
    });
  }, [last, mode, pending, sessionId]);

  const restart = () => {
    setQueue(cards);
    setFlipped(false);
    setLast(null);
    setError("");
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.code === "Space" && current && !(target instanceof HTMLElement && target.closest("button, a"))) {
        event.preventDefault();
        setFlipped((value) => !value);
      }
      if (event.key === "1") grade("again");
      if (event.key === "2") grade("hard");
      if (event.key === "3") grade("good");
      if (event.key.toLowerCase() === "u") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, grade, undo]);

  if (!current) {
    return (
      <div className="mx-auto flex min-h-[75dvh] max-w-2xl flex-col items-center justify-center text-center">
        <div className="grid size-20 place-items-center rounded-full bg-correct/10 text-correct"><Check size={38} weight="bold" /></div>
        <h1 className="mt-7 text-4xl font-bold tracking-[-.035em]">{mode === "preview" ? "Đã xem hết thẻ." : "Đã học xong hôm nay."}</h1>
        <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">
          {mode === "preview" ? "Bạn có thể xem lại từ đầu hoặc quay lại chỉnh sửa bài học." : "Kotoba đã lên lịch lần gặp tiếp theo cho từng thẻ dựa trên câu trả lời của bạn."}
        </p>
        {mode === "preview" ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {last ? <button type="button" onClick={undo} className="button-secondary">Hoàn tác thẻ cuối</button> : null}
            <button type="button" onClick={restart} className="button-primary">Xem lại từ đầu</button>
            <Link href={backHref} className="button-secondary">Quay lại bài học</Link>
          </div>
        ) : <Link href={backHref} className="button-primary mt-8">Trở về lớp</Link>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col pb-28 md:pb-8">
      <header className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <Link href={backHref} className="quiet-link text-sm">{mode === "preview" ? "Quay lại bài học" : "Thoát phiên học"}</Link>
          <h1 className="mt-2 break-words text-lg font-bold">{lessonTitle}</h1>
          {mode === "preview" ? <p className="mt-1 text-sm font-semibold text-muted">Xem thử · Không lưu kết quả</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums">{completed + 1} / {total}</p>
          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${((completed + 1) / total) * 100}%` }} />
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center py-8">
        <div
          key={current.id}
          className="flip-stage paper-shadow card-enter relative min-h-[430px] w-full max-w-3xl rounded-2xl bg-surface-strong text-left sm:min-h-[520px]"
        >
          <span className={`flip-plane block min-h-[430px] sm:min-h-[520px] ${flipped ? "is-flipped" : ""}`}>
            <span className="flip-face flip-front p-7 sm:p-12">
              <span className="text-sm font-semibold text-muted">Nhấn Space hoặc chạm để lật</span>
              <span className="font-jp break-words text-center text-[clamp(5rem,16vw,9rem)] font-semibold leading-none tracking-[-.03em]">{current.kanji}</span>
              <span className="text-right text-xs font-bold uppercase tracking-[.08em] text-muted">Kanji</span>
            </span>
            <span className="flip-face flip-back p-7 sm:p-12">
              <span className="text-sm font-semibold text-muted">Mặt sau</span>
              <span className="space-y-8">
                <span className="block">
                  <span className="font-jp block break-words text-4xl font-semibold sm:text-5xl">{current.hiragana}</span>
                  <span className="mt-3 block break-words text-2xl font-bold sm:text-3xl">{current.meaning_vi}</span>
                </span>
                <span className="block border-t border-line pt-7">
                  <span className="font-jp block break-words text-xl leading-relaxed sm:text-2xl">{current.example_ja}</span>
                  <span className="mt-3 block break-words text-base leading-relaxed text-muted sm:text-lg">{current.example_vi}</span>
                </span>
              </span>
              <span className="text-right text-xs font-bold uppercase tracking-[.08em] text-muted">Chọn mức độ nhớ bên dưới</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="flip-hit-target absolute inset-0 z-10 w-full cursor-pointer rounded-2xl"
            aria-label={flipped ? "Xem mặt kanji" : "Lật thẻ để xem đáp án"}
          />
        </div>
      </div>
      {error && <p role="alert" className="mb-4 text-center text-sm font-semibold text-wrong">{error}</p>}
      <div className={`answer-controls fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 px-3 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none ${flipped ? "is-ready" : ""}`}>
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2 sm:gap-5">
          {actions.map(({ rating, label, key, Icon, tone }) => (
            <button
              key={label}
              type="button"
              onClick={() => rating ? grade(rating) : undo()}
              disabled={pending || (rating ? !flipped : !last)}
              className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`${label}, phím ${key}`}
            >
              <span className={`grid size-14 place-items-center rounded-full bg-surface-strong paper-shadow transition-transform group-hover:-translate-y-1 sm:size-18 ${tone}`}><Icon size={28} weight="bold" /></span>
              <span className="text-xs font-bold">{label}</span>
              <kbd className="hidden text-xs text-muted sm:block">{key}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
