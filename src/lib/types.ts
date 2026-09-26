export type WorkspaceRole = "teacher" | "student";
export type UserRole = WorkspaceRole | "admin";
export type LessonStatus = "draft" | "published";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked";
export type ReviewRating = "again" | "hard" | "good";
export type StudyActivity = "flashcards" | "quiz";
export type StudyDirection = "front-first" | "back-first";
export type StudyConfiguration = {
  direction: StudyDirection;
  scope: "due" | "all";
  count: number | "all";
  shuffle: boolean;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  active_mode: WorkspaceRole | null;
};

export type StudyCard = {
  id: string;
  kanji: string;
  hiragana: string;
  meaning_vi: string;
  example_ja: string;
  example_vi: string;
};
