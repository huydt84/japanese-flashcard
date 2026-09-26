"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowCounterClockwise, CaretDown, Check, QuestionMark, Shuffle, X } from "@phosphor-icons/react";
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
  // Saving a review refreshes the server's due-card list, not the active session's deck.
  const [sessionCards] = useState(cards);
  const [queue, setQueue] = useState(sessionCards);
  const [backFirst, setBackFirst] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [last, setLast] = useState<StudyCard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const sessionId = useMemo(() => mode === "study" ? crypto.randomUUID() : null, [mode]);
  const total = sessionCards.length;
  const current = queue[0];
  const completed = total - queue.length;

  const grade = useCallback((rating: ReviewRating) => {
    if (!current || pending) return;
    setError("");
    setNotice("");

    if (mode === "preview") {
      setLast(current);
      setQueue((items) => items.slice(1));
      setFlipped(backFirst);
      return;
    }

    startTransition(async () => {
      try {
        await submitReview(current.id, sessionId!, rating);
        setLast(current);
        setQueue((items) => items.slice(1));
        setFlipped(backFirst);
      } catch {
        setError("Không thể lưu câu trả lời. Hãy kiểm tra kết nối và thử lại.");
      }
    });
  }, [backFirst, current, mode, pending, sessionId]);

  const undo = useCallback(() => {
    if (pending) return;
    setError("");
    if (!last) {
      setNotice("Chưa có câu trả lời để hoàn tác.");
      return;
    }
    setNotice("");

    if (mode === "preview") {
      setQueue((items) => [last, ...items]);
      setLast(null);
      setFlipped(!backFirst);
      return;
    }

    startTransition(async () => {
      try {
        await undoReview(sessionId!);
        setQueue((items) => [last, ...items]);
        setLast(null);
        setFlipped(!backFirst);
      } catch {
        setError("Không thể hoàn tác câu trả lời gần nhất.");
      }
    });
  }, [backFirst, last, mode, pending, sessionId]);

  const shuffle = () => {
    if (pending || queue.length < 2) return;
    const shuffled = [...queue];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    setQueue(shuffled);
    setFlipped(backFirst);
    setError("");
    setNotice(`Đã tráo ${shuffled.length} thẻ còn lại.`);
  };

  const restart = () => {
    setQueue(sessionCards);
    setFlipped(backFirst);
    setLast(null);
    setError("");
    setNotice("");
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
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
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-wrong">{error}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {last ? <button type="button" onClick={undo} disabled={pending} className="button-secondary">Hoàn tác thẻ cuối</button> : null}
          {mode === "preview" ? <button type="button" onClick={restart} className="button-primary">Xem lại từ đầu</button> : null}
          <Link href={backHref} className={mode === "preview" ? "button-secondary" : "button-primary"}>{mode === "preview" ? "Quay lại bài học" : "Trở về lớp"}</Link>
        </div>
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
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="label">Chiều học</span>
          <span className="relative block">
            <select
              value={backFirst ? "back-first" : "front-first"}
              onChange={(event) => {
                const nextBackFirst = event.target.value === "back-first";
                setBackFirst(nextBackFirst);
                setFlipped(nextBackFirst);
                setNotice("");
              }}
              disabled={pending}
              className="field study-direction min-h-11 text-sm font-semibold"
            >
              <option value="front-first">Mặt trước → Mặt sau</option>
              <option value="back-first">Mặt sau → Mặt trước</option>
            </select>
            <CaretDown size={16} weight="bold" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </span>
        </label>
        <button
          type="button"
          onClick={shuffle}
          disabled={pending || queue.length < 2}
          className="button-secondary shrink-0 text-sm"
          title={queue.length < 2 ? "Cần ít nhất 2 thẻ còn lại để tráo" : "Tráo ngẫu nhiên các thẻ còn lại"}
        >
          <Shuffle size={18} weight="bold" aria-hidden="true" />
          Tráo thẻ
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center py-8">
        <div
          key={current.id}
          className="flip-stage paper-shadow card-enter relative min-h-[430px] w-full max-w-3xl rounded-2xl bg-surface-strong text-left sm:min-h-[520px]"
        >
          <span className={`flip-plane block min-h-[430px] sm:min-h-[520px] ${flipped ? "is-flipped" : ""}`}>
            <span role="group" aria-label="Mặt trước" aria-hidden={flipped} className="flip-face flip-front p-7 sm:p-12">
              <span className="text-sm font-semibold text-muted">Nhấn Space hoặc chạm để lật</span>
              <span className="font-jp break-words text-center text-[clamp(5rem,16vw,9rem)] font-semibold leading-none tracking-[-.03em]">{current.kanji}</span>
              <span className="text-right text-xs font-bold uppercase tracking-[.08em] text-muted">Kanji</span>
            </span>
            <span role="group" aria-label="Mặt sau" aria-hidden={!flipped} className="flip-face flip-back p-7 sm:p-12">
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
      <p role="status" className="mb-4 min-h-5 text-center text-sm text-muted">{pending ? "Đang lưu thay đổi…" : notice}</p>
      <div className="answer-controls fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 px-3 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2 sm:gap-5">
          {actions.map(({ rating, label, key, Icon, tone }) => (
            <button
              key={label}
              type="button"
              onClick={() => rating ? grade(rating) : undo()}
              aria-disabled={pending}
              className="group flex cursor-pointer flex-col items-center gap-1.5 aria-disabled:cursor-wait"
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
