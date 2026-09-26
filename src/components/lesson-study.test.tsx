import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { LessonStudy } from "./lesson-study";

const { submitReview, undoReview, refresh } = vi.hoisted(() => ({ submitReview: vi.fn(), undoReview: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions", () => ({ submitReview, undoReview }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeAll(() => {
  // jsdom has no top layer; real focus trapping and Escape behavior are covered in Playwright.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

const cards = [
  { id: "one", kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học", example_ja: "日本語を学びます。", example_vi: "Tôi học tiếng Nhật." },
  { id: "two", kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ご飯を食べます。", example_vi: "Tôi ăn sáng." },
];
const props = { mode: "study" as const, lessonTitle: "Buổi 1", description: "Động từ", cards, dueCardIds: ["one"], backHref: "/student" };

it("shows every word, shares settings between both mode selectors, and starts only after confirmation", () => {
  render(<LessonStudy {...props} />);
  expect(screen.getByText("学ぶ")).toBeInTheDocument();
  expect(screen.queryByText("食べる")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Xem nhóm thẻ"), { target: { value: "all" } });
  expect(screen.getByText("食べる")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Xem nhóm thẻ"), { target: { value: "due" } });
  expect(screen.queryByRole("button", { name: "Lật thẻ để xem đáp án" })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" })[1]);
  fireEvent.change(screen.getByLabelText("Chiều học"), { target: { value: "back-first" } });
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" })[0]);
  expect(screen.getByLabelText("Chiều học")).toHaveValue("back-first");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Mặt sau" })).toHaveTextContent("まなぶ");
  fireEvent.click(screen.getByRole("button", { name: "Quay lại bài học" }));
  expect(screen.getByText("学ぶ")).toBeInTheDocument();
  expect(refresh).toHaveBeenCalledOnce();
  expect(submitReview).not.toHaveBeenCalled();
});

it("keeps an active deck through new server props, then shows refreshed due counts on return", async () => {
  submitReview.mockResolvedValue({ due: "2100-01-01" });
  const { rerender } = render(<LessonStudy {...props} dueCardIds={cards.map((card) => card.id)} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
  await screen.findByText("2 / 2");
  rerender(<LessonStudy {...props} dueCardIds={["two"]} />);
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
  expect(screen.getByText("食べる")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Quay lại bài học" }));
  expect(screen.getByText("1 thẻ đến hạn hoặc chưa học")).toBeInTheDocument();
});

it("allows practice with all cards when nothing is due and validates custom counts", () => {
  render(<LessonStudy {...props} dueCardIds={[]} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" })[0]);
  expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Từ vựng để học"), { target: { value: "all" } });
  fireEvent.click(screen.getByLabelText(/Học tất cả/));
  fireEvent.change(screen.getByLabelText("Số thẻ trong phiên"), { target: { value: "3" } });
  expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Số thẻ trong phiên"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
});

it("filters the vocabulary list by latest rating and carries the group into both modes", () => {
  render(<LessonStudy {...props} reviewProgress={[
    { card_id: "one", due_at: "2020-01-01", last_rating: "hard" },
    { card_id: "two", due_at: null, last_rating: "good" },
  ]} />);
  const listScope = screen.getByLabelText("Xem nhóm thẻ");
  expect(listScope).toHaveValue("due");
  expect(screen.getByText("学ぶ")).toBeInTheDocument();
  expect(screen.queryByText("食べる")).not.toBeInTheDocument();
  fireEvent.change(listScope, { target: { value: "good" } });
  expect(screen.queryByText("学ぶ")).not.toBeInTheDocument();
  expect(screen.getByText("食べる")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" })[0]);
  expect(screen.getByLabelText("Từ vựng để học")).toHaveValue("good");
  expect(screen.getByText("1 thẻ có thể học.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Trắc nghiệm" })[0]);
  expect(screen.getByLabelText("Từ vựng để học")).toHaveValue("good");
});

it("refreshes the overview when the next card becomes due", () => {
  vi.useFakeTimers();
  const nextDueAt = new Date(Date.now() + 1_000).toISOString();
  render(<LessonStudy {...props} nextDueAt={nextDueAt} />);
  expect(refresh).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1_100));
  expect(refresh).toHaveBeenCalledOnce();
});

it.each(["study", "preview"] as const)("scores and locks quiz answers in %s without saving reviews", async (mode) => {
  render(<LessonStudy {...props} mode={mode} />);
  if (mode === "study") fireEvent.change(screen.getByLabelText("Xem nhóm thẻ"), { target: { value: "all" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Trắc nghiệm" })[0]);
  if (mode === "preview") expect(screen.queryByLabelText("Từ vựng để học")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Tráo thứ tự câu hỏi"));
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
  const options = within(screen.getByRole("group", { name: "Các đáp án" }));
  fireEvent.click(options.getByRole("button", { name: "học" }));
  expect(screen.getByRole("status")).toHaveTextContent("Chính xác!");
  fireEvent.click(options.getByRole("button", { name: "ăn" }));
  expect(screen.getByRole("status")).toHaveTextContent("Chính xác!");
  fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
  fireEvent.click(within(screen.getByRole("group", { name: "Các đáp án" })).getByRole("button", { name: "học" }));
  expect(screen.getByRole("status")).toHaveTextContent("Chưa đúng. Đáp án: ăn");
  fireEvent.click(screen.getByRole("button", { name: "Xem kết quả" }));
  expect(screen.getByText("1 / 2 câu đúng")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Làm bài mới" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await act(async () => {});
  expect(submitReview).not.toHaveBeenCalled();
  expect(undoReview).not.toHaveBeenCalled();
});

it("distinguishes an empty lesson from an unavailable quiz", () => {
  const { rerender } = render(<LessonStudy {...props} cards={[]} dueCardIds={[]} />);
  expect(screen.getByRole("heading", { name: "Bài học chưa có từ vựng" })).toBeInTheDocument();
  expect(screen.queryByText(/Bạn vẫn có thể luyện tập/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Thẻ ghi nhớ" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  rerender(<LessonStudy {...props} cards={[cards[0]]} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Trắc nghiệm" })[0]);
  expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Cần ít nhất hai đáp án khác nhau");
});
