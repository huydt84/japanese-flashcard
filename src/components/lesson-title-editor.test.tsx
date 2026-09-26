import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonTitleEditor } from "./lesson-title-editor";

describe("LessonTitleEditor", () => {
  it("saves an edited name and shows it as the heading", async () => {
    const action = vi.fn(async (previous, formData: FormData) => {
      expect(formData.get("title")).toBe("Động từ N5");
      return { status: "success" as const, message: "Đã đổi tên buổi học.", revision: previous.revision + 1 };
    });
    render(<LessonTitleEditor title="Buổi 1" action={action} />);

    fireEvent.click(screen.getByRole("button", { name: /Buổi 1/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên buổi học" }), { target: { value: "Động từ N5" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Động từ N5" })).toBeInTheDocument());
    expect(action).toHaveBeenCalledOnce();
  });

  it("keeps the original name when editing is canceled", () => {
    render(<LessonTitleEditor title="Buổi 1" action={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Buổi 1/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên buổi học" }), { target: { value: "Tên khác" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(screen.getByRole("heading", { name: "Buổi 1" })).toBeInTheDocument();
  });
});
