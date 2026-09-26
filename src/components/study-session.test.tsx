import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudySession } from "./study-session";

const { submitReview, undoReview } = vi.hoisted(() => ({ submitReview: vi.fn(), undoReview: vi.fn() }));

vi.mock("@/app/actions", () => ({ submitReview, undoReview }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const cards = [
  { id: "one", kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học", example_ja: "日本語を学びます。", example_vi: "Tôi học tiếng Nhật." },
  { id: "two", kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ご飯を食べます。", example_vi: "Tôi ăn sáng." },
];

describe("teacher flashcard preview", () => {
  it("runs through the cards, undoes the final answer and restarts without saving progress", () => {
    render(<StudySession mode="preview" lessonTitle="Buổi 1" cards={cards} backHref="/teacher/classes/class-1/lessons/lesson-1" />);

    expect(screen.getByText("Xem thử · Không lưu kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
    expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
    expect(screen.getByText("食べる")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: /Sai, phím 1/ }));
    expect(screen.getByRole("heading", { name: "Đã xem hết thẻ." })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
    expect(screen.getByText("食べる")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoàn tác, phím U/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Chưa chắc, phím 2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xem lại từ đầu" }));
    expect(screen.getByText("学ぶ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeDisabled();
    expect(submitReview).not.toHaveBeenCalled();
    expect(undoReview).not.toHaveBeenCalled();
  });
});

it("lets a student undo the final answer, including retrying a failed undo", async () => {
  submitReview.mockResolvedValue({ due: "2030-01-01" });
  undoReview.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ cardId: "one" });
  render(<StudySession mode="study" lessonTitle="Buổi 1" cards={[cards[0]]} backHref="/student" />);
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
  fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
  await screen.findByRole("heading", { name: "Đã học xong hôm nay." });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể hoàn tác");
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
  expect(await screen.findByText("まなぶ")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
});
