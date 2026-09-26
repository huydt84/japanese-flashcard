import type { StudyScope } from "./types";

export const studyScopes: { value: StudyScope; label: string }[] = [
  { value: "due", label: "Đến hạn + chưa học" },
  { value: "again", label: "Sai" },
  { value: "hard", label: "Chưa chắc" },
  { value: "good", label: "Đúng" },
  { value: "all", label: "Tất cả" },
];
