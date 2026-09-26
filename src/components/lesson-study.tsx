"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Cards, ListChecks } from "@phosphor-icons/react";
import { buildQuizQuestions, quizCandidates, selectSessionCards, type QuizQuestion } from "@/lib/lesson-study";
import { studyScopes } from "@/lib/review-scope";
import type { ReviewRating, StudyActivity, StudyCard, StudyConfiguration, StudyScope } from "@/lib/types";
import { StudySession } from "./study-session";
import { QuizSession } from "./quiz-session";
import { StudyConfigurationDialog } from "./study-configuration-dialog";
import { VocabularyEntry } from "./vocabulary-entry";

type Props = {
  mode: "study" | "preview";
  lessonTitle: string;
  description: string | null;
  cards: StudyCard[];
  dueCardIds?: string[];
  reviewProgress?: { card_id: string; due_at: string | null; last_rating: ReviewRating | null }[];
  nextDueAt?: string | null;
  backHref: string;
};

type View = { kind: "overview" }
  | { kind: "flashcards"; cards: StudyCard[]; config: StudyConfiguration }
  | { kind: "quiz"; questions: QuizQuestion[]; config: StudyConfiguration };

const activities = [
  { id: "flashcards", label: "Thẻ ghi nhớ", description: "Lật thẻ, tự đánh giá mức độ nhớ.", Icon: Cards },
  { id: "quiz", label: "Trắc nghiệm", description: "Chọn đáp án, xem kết quả ngay.", Icon: ListChecks },
] as const;

function ModePicker({ location, disabled, onChoose }: { location: "top" | "bottom"; disabled: boolean; onChoose: (activity: StudyActivity, trigger: HTMLButtonElement) => void }) {
  return (
    <section aria-label={location === "top" ? "Chế độ học đầu danh sách" : "Chế độ học cuối danh sách"} className="grid gap-3 sm:grid-cols-2">
      {activities.map(({ id, label, description, Icon }) => <button key={id} type="button" className="study-mode group flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface-strong p-5 text-left" disabled={disabled} onClick={(event) => onChoose(id, event.currentTarget)} aria-label={label}>
        <Icon size={28} weight="duotone" className="shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-lg font-bold">{label}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{description}</span></span>
        <ArrowUpRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
      </button>)}
    </section>
  );
}

export function LessonStudy({ mode, lessonTitle, description, cards, dueCardIds = [], reviewProgress = [], nextDueAt = null, backHref }: Props) {
  const router = useRouter();
  const preview = mode === "preview";
  const [view, setView] = useState<View>({ kind: "overview" });
  const [activity, setActivity] = useState<StudyActivity | null>(null);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const [scope, setScope] = useState<StudyScope>(preview ? "all" : "due");
  const [configs, setConfigs] = useState<Record<StudyActivity, StudyConfiguration>>({
    flashcards: { direction: "front-first", scope: preview ? "all" : "due", count: "all", shuffle: false },
    quiz: { direction: "front-first", scope: preview ? "all" : "due", count: 10, shuffle: true },
  });
  const [refreshing, startRefresh] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const restoreOverview = useRef(false);
  const scrollPosition = useRef(0);
  const due = useMemo(() => new Set(dueCardIds), [dueCardIds]);
  const ratings = useMemo(() => new Map(reviewProgress.map((item) => [item.card_id, item.last_rating])), [reviewProgress]);

  function inScope(card: StudyCard, selectedScope: StudyScope) {
    return selectedScope === "all" || (selectedScope === "due" ? due.has(card.id) : ratings.get(card.id) === selectedScope);
  }

  const scopeCounts = Object.fromEntries(studyScopes.map(({ value }) => [value, cards.filter((card) => inScope(card, value)).length])) as Record<StudyScope, number>;
  const visibleCards = preview ? cards : cards.filter((card) => inScope(card, scope));

  useEffect(() => {
    if (preview || view.kind !== "overview" || !nextDueAt) return;
    const dueTime = new Date(nextDueAt).getTime();
    if (!Number.isFinite(dueTime)) return;
    const refresh = () => startRefresh(() => router.refresh());
    const timer = window.setTimeout(refresh, Math.min(Math.max(dueTime - Date.now() + 50, 0), 2_147_000_000));
    const onReturn = () => { if (document.visibilityState === "visible" && Date.now() >= dueTime) refresh(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onReturn); window.removeEventListener("focus", onReturn); };
  }, [nextDueAt, preview, router, view.kind]);

  function candidates(selectedActivity: StudyActivity, config: StudyConfiguration) {
    const allowedCards = preview ? cards : cards.filter((card) => inScope(card, config.scope));
    return selectedActivity === "quiz" ? quizCandidates(cards, config.direction, new Set(allowedCards.map((card) => card.id))) : allowedCards;
  }

  function choose(nextActivity: StudyActivity, trigger?: HTMLButtonElement) {
    const config = { ...configs[nextActivity], scope };
    const available = candidates(nextActivity, config).length;
    setConfigs((previous) => ({ ...previous, [nextActivity]: { ...config, count: config.count === "all" ? "all" : Math.min(Math.max(1, config.count), Math.max(1, available)) } }));
    setActivity(nextActivity);
    setReturnFocusTo(trigger ?? null);
  }

  function updateConfig(config: StudyConfiguration) {
    if (!activity) return;
    const previous = { ...configs[activity], scope };
    if (config.direction !== previous.direction || config.scope !== previous.scope) {
      const available = candidates(activity, config).length;
      config = { ...config, count: config.count === "all" ? "all" : Math.min(Math.max(1, config.count), Math.max(1, available)) };
    }
    setScope(config.scope);
    setConfigs((previous) => ({ ...previous, [activity]: config }));
  }

  function start() {
    if (!activity) return;
    const config = { ...configs[activity], scope };
    const available = candidates(activity, config);
    if (!available.length || (config.count !== "all" && (!Number.isInteger(config.count) || config.count < 1 || config.count > available.length))) return;
    const selected = selectSessionCards(available, config);
    scrollPosition.current = window.scrollY;
    setView(activity === "flashcards" ? { kind: "flashcards", cards: selected, config } : { kind: "quiz", questions: buildQuizQuestions(selected, cards, config.direction), config });
    setActivity(null);
    window.scrollTo(0, 0);
  }

  function returnToOverview() {
    restoreOverview.current = true;
    setView({ kind: "overview" });
    if (!preview) startRefresh(() => router.refresh());
  }

  useEffect(() => {
    if (view.kind === "overview" && restoreOverview.current) {
      restoreOverview.current = false;
      titleRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, scrollPosition.current);
    }
  }, [view.kind]);

  if (view.kind === "flashcards") return <StudySession mode={mode} lessonTitle={lessonTitle} cards={view.cards} initialDirection={view.config.direction} onExit={returnToOverview} />;
  if (view.kind === "quiz") return <QuizSession lessonTitle={lessonTitle} questions={view.questions} direction={view.config.direction} preview={preview} onExit={returnToOverview} onConfigure={() => { returnToOverview(); choose("quiz"); }} />;

  const config = activity ? { ...configs[activity], scope } : null;
  const available = activity && config ? candidates(activity, config).length : 0;
  const scopeCount = config ? scopeCounts[config.scope] : 0;

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <Link href={backHref} className="quiet-link inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft size={18} aria-hidden="true" />{preview ? "Quay lại chỉnh sửa" : "Trở về lớp"}</Link>
      <header className="mb-8 mt-5">
        <h1 ref={titleRef} tabIndex={-1} className="break-words text-3xl font-bold leading-tight tracking-[-.03em] sm:text-4xl">{lessonTitle}</h1>
        {description && <p className="mt-3 max-w-3xl break-words leading-relaxed text-muted">{description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
          <span className="text-muted">{cards.length} từ vựng</span>
          {preview ? <span className="text-muted">Xem thử · Không lưu kết quả</span> : cards.length > 0 ? <span className={due.size ? "text-brand" : "text-muted"}>{due.size ? `${due.size} thẻ đến hạn hoặc chưa học` : "Không có thẻ đến hạn. Bạn vẫn có thể luyện tập."}</span> : null}
        </div>
      </header>
      <ModePicker location="top" disabled={!cards.length || refreshing} onChoose={choose} />
      {refreshing && <p role="status" className="mt-3 text-sm text-muted">Đang cập nhật lịch ôn…</p>}
      <section className="my-10" aria-labelledby="vocabulary-heading">
        <h2 id="vocabulary-heading" className="mb-5 text-xl font-bold">Từ vựng trong bài</h2>
        {!preview && cards.length > 0 && <div className="mb-5 max-w-sm">
          <label htmlFor="vocabulary-scope" className="label">Xem nhóm thẻ</label>
          <select id="vocabulary-scope" className="field min-h-11" value={scope} onChange={(event) => setScope(event.target.value as StudyScope)}>
            {studyScopes.map(({ value, label }) => <option key={value} value={value}>{label} ({scopeCounts[value]})</option>)}
          </select>
        </div>}
        {visibleCards.length ? <ol className="divide-y divide-line border-y border-line">{visibleCards.map((card) => <li key={card.id} className="py-6 sm:py-7"><VocabularyEntry card={card} /></li>)}</ol> : cards.length > 0 ? <p className="rounded-2xl bg-surface p-8 text-muted">Nhóm này chưa có thẻ. Hãy chọn nhóm khác để xem và luyện tập.</p> : <div className="rounded-2xl bg-surface p-8 text-center">
          <h3 className="text-xl font-bold">Bài học chưa có từ vựng</h3>
          <p className="mt-3 text-muted">{preview ? "Quay lại chỉnh sửa để thêm thẻ đầu tiên." : "Giáo viên sẽ thêm từ vựng vào bài học này."}</p>
        </div>}
      </section>
      <ModePicker location="bottom" disabled={!cards.length || refreshing} onChoose={choose} />
      {activity && config && <StudyConfigurationDialog activity={activity} config={config} preview={preview} available={available} scopeCount={scopeCount} scopeCounts={scopeCounts} returnFocusTo={returnFocusTo} fallbackFocus={titleRef} onChange={updateConfig} onClose={() => setActivity(null)} onStart={start} />}
    </div>
  );
}
