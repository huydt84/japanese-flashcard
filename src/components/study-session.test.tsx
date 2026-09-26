import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudySession } from "./study-session";

const { submitReview, undoReview } = vi.hoisted(() => ({ submitReview: vi.fn(), undoReview: vi.fn() }));

vi.mock("@/app/actions", () => ({ submitReview, undoReview }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

const cards = [
  { id: "one", kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học", example_ja: "日本語を学びます。", example_vi: "Tôi học tiếng Nhật." },
  { id: "two", kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ご飯を食べます。", example_vi: "Tôi ăn sáng." },
];

describe("teacher flashcard preview", () => {
  it("runs through the cards, undoes the final answer and restarts without saving progress", () => {
    render(<StudySession mode="preview" lessonTitle="Buổi 1" cards={cards} onExit={() => {}} />);

    expect(screen.getByText("Xem thử · Không lưu kết quả")).toBeInTheDocument();
    for (const name of [/Hoàn tác, phím U/, /Sai, phím 1/, /Chưa chắc, phím 2/, /Đúng, phím 3/]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("button", { name: /Hoàn tác, phím U/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Chưa có câu trả lời để hoàn tác.");

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem mặt kanji" }));
    expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
    expect(screen.getByText("食べる")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hoàn tác, phím U/ }));
    expect(screen.getByText("学ぶ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: /Sai, phím 1/ }));
    expect(screen.getByRole("heading", { name: "Đã xem hết thẻ." })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
    expect(screen.getByText("食べる")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoàn tác, phím U/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Chưa chắc, phím 2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xem lại từ đầu" }));
    expect(screen.getByText("学ぶ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
    expect(submitReview).not.toHaveBeenCalled();
    expect(undoReview).not.toHaveBeenCalled();
  });
});

it("starts each card on the selected face, including after undo and restart", () => {
  render(<StudySession mode="preview" lessonTitle="Buổi 1" cards={cards} onExit={() => {}} />);
  const direction = screen.getByRole("combobox", { name: "Chiều học" });
  fireEvent.change(direction, { target: { value: "back-first" } });
  fireEvent.keyDown(direction, { key: "3" });
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("まなぶ")).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Mặt trước" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Xem mặt kanji" }));
  expect(within(screen.getByRole("group", { name: "Mặt trước" })).getByText("学ぶ")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "3" });
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("たべる")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "u" });
  expect(within(screen.getByRole("group", { name: "Mặt trước" })).getByText("学ぶ")).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "1" });
  fireEvent.keyDown(window, { key: "2" });
  fireEvent.click(screen.getByRole("button", { name: "Xem lại từ đầu" }));
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("まなぶ")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Chiều học" })).toHaveValue("back-first");

  fireEvent.change(screen.getByRole("combobox", { name: "Chiều học" }), { target: { value: "front-first" } });
  fireEvent.keyDown(window, { key: "3" });
  expect(within(screen.getByRole("group", { name: "Mặt trước" })).getByText("食べる")).toBeInTheDocument();
});

it("shuffles only remaining cards without losing progress, cards or the latest undo", () => {
  const deck = [...cards,
    { ...cards[0], id: "three", kanji: "読む", hiragana: "よむ" },
    { ...cards[0], id: "four", kanji: "書く", hiragana: "かく" },
  ];
  render(<StudySession mode="preview" lessonTitle="Buổi 1" cards={deck} onExit={() => {}} />);
  fireEvent.keyDown(window, { key: "3" });
  fireEvent.change(screen.getByRole("combobox", { name: "Chiều học" }), { target: { value: "back-first" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem mặt kanji" }));
  vi.spyOn(Math, "random").mockReturnValue(0);
  fireEvent.click(screen.getByRole("button", { name: "Tráo thẻ" }));
  expect(screen.getByText("2 / 4")).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("よむ")).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "u" });
  expect(screen.getByText("1 / 4")).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Mặt trước" })).getByText("学ぶ")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "3" });
  for (const hiragana of ["よむ", "かく", "たべる"]) {
    expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText(hiragana)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "3" });
  }
  expect(screen.getByRole("heading", { name: "Đã xem hết thẻ." })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xem lại từ đầu" }));
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("まなぶ")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "3" });
  expect(within(screen.getByRole("group", { name: "Mặt sau" })).getByText("たべる")).toBeInTheDocument();
  expect(submitReview).not.toHaveBeenCalled();
  expect(undoReview).not.toHaveBeenCalled();
});

it.each([
  ["1", "again"], ["2", "hard"], ["3", "good"],
])("saves a student's rating with shortcut %s from the front face", async (key, rating) => {
  submitReview.mockResolvedValue({ due: "2030-01-01" });
  render(<StudySession mode="study" lessonTitle="Buổi 1" cards={cards} onExit={() => {}} />);
  fireEvent.keyDown(window, { key });
  await screen.findByText("食べる");
  expect(submitReview).toHaveBeenCalledExactlyOnceWith("one", expect.any(String), rating);
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
});

it("keeps the current card on a failed save and prevents grading or shuffling while saving", async () => {
  let rejectSave!: (error: Error) => void;
  submitReview.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
  render(<StudySession mode="study" lessonTitle="Buổi 1" cards={cards} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
  fireEvent.keyDown(window, { key: "1" });
  fireEvent.keyDown(window, { key: "u" });
  expect(screen.getByRole("button", { name: "Tráo thẻ" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Chiều học" })).toBeDisabled();
  expect(submitReview).toHaveBeenCalledTimes(1);
  expect(undoReview).not.toHaveBeenCalled();
  await act(async () => rejectSave(new Error("offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("Không thể lưu câu trả lời");
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  submitReview.mockResolvedValueOnce({ due: "2030-01-01" });
  fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
  await screen.findByText("食べる");
  expect(submitReview).toHaveBeenCalledTimes(2);
});

it("lets a student undo the final answer, including retrying a failed undo", async () => {
  submitReview.mockResolvedValue({ due: "2030-01-01" });
  undoReview.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ cardId: "one" });
  render(<StudySession mode="study" lessonTitle="Buổi 1" cards={[cards[0]]} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ để xem đáp án" }));
  fireEvent.click(screen.getByRole("button", { name: /Đúng, phím 3/ }));
  await screen.findByRole("heading", { name: "Đã hoàn thành phiên học." });
  await waitFor(() => expect(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể hoàn tác");
  await waitFor(() => expect(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tác thẻ cuối" }));
  expect(await screen.findByText("まなぶ")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
});
