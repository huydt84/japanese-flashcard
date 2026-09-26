import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LessonEditor from "./page";

vi.mock("@/lib/auth", () => ({
  requireProfile: async () => ({
    supabase: {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          single: async () => ({ data: table === "lessons" ? { id: "lesson-1", title: "Buổi 1", description: "", status: "draft" } : null }),
          then: (resolve: (value: unknown) => unknown) => resolve({ data: [] }),
        };
        return query;
      },
    },
  }),
}));

vi.mock("@/components/action-form", () => ({ ActionForm: () => null }));
vi.mock("@/components/xlsx-importer", () => ({ XlsxImporter: () => null }));

describe("lesson editor title", () => {
  it("opens a title field when the teacher clicks the lesson name", async () => {
    const page = await LessonEditor({ params: Promise.resolve({ classId: "class-1", lessonId: "lesson-1" }), searchParams: Promise.resolve({}) });
    render(page);

    fireEvent.click(screen.getByRole("button", { name: /Buổi 1/ }));

    expect(screen.getByRole("textbox", { name: "Tên buổi học" })).toHaveValue("Buổi 1");
  });
});
