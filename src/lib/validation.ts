import { z } from "zod";

export const roleSchema = z.enum(["teacher", "student"]);
export const uuidSchema = z.string().uuid();
export const classSchema = z.object({
  name: z.string().trim().min(2, "Tên lớp cần ít nhất 2 ký tự").max(80),
  description: z.string().trim().max(240).default(""),
});
export const lessonSchema = z.object({
  title: z.string().trim().min(2, "Tên bài cần ít nhất 2 ký tự").max(100),
  description: z.string().trim().max(300).default(""),
});
export const cardSchema = z.object({
  kanji: z.string().trim().min(1, "Thiếu kanji").max(80),
  hiragana: z.string().trim().min(1, "Thiếu hiragana").max(120),
  meaning_vi: z.string().trim().min(1, "Thiếu nghĩa tiếng Việt").max(240),
  example_ja: z.string().trim().min(1, "Thiếu câu ví dụ").max(500),
  example_vi: z.string().trim().min(1, "Thiếu bản dịch").max(500),
});
export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ").max(254),
});

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

