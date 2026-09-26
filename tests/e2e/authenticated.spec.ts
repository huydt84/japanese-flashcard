import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_AUTH_E2E === "1";
test.skip(!enabled, "Requires the isolated local Supabase stack");

const apiUrl = process.env.TEST_SUPABASE_URL ?? "";
const secretKey = process.env.TEST_SUPABASE_SECRET_KEY ?? "";
const password = "Local-test-only-123!";
const stamp = crypto.randomUUID();
const teacherEmail = `ui-teacher-${stamp}@example.test`;
const studentEmail = `ui-student-${stamp}@example.test`;
const developerEmail = `ui-admin-${stamp}@example.test`;
const otherTeacherEmail = `ui-other-teacher-${stamp}@example.test`;
const createdUsers: string[] = [];
let classId = "";
let lessonId = "";
let draftLessonId = "";
let emptyLessonId = "";
let draftCardIds: string[] = [];
const longExample = "Tôi viết một lá thư rất dài. ".repeat(15).trim();

test.beforeAll(async () => {
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  for (const [email, role] of [[teacherEmail, "teacher"], [studentEmail, "student"], [developerEmail, "admin"], [otherTeacherEmail, "teacher"]] as const) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: role === "teacher" ? "Mai Sensei" : "Huy" } });
    if (error) throw error;
    createdUsers.push(data.user.id);
    await admin.from("profiles").update({ role, active_mode: role === "admin" ? "student" : null, onboarding_completed_at: new Date().toISOString() }).eq("id", data.user.id);
  }
  const { data: klass, error: classError } = await admin.from("classes").insert({ teacher_id: createdUsers[0], name: "Tên lớp học", description: "Từ vựng N5 dùng mỗi ngày" }).select("id").single();
  if (classError || !klass) throw classError ?? new Error("Không tạo được lớp kiểm thử");
  classId = klass.id;
  await admin.from("class_memberships").insert({ class_id: klass.id, student_id: createdUsers[1] });
  const { data: lesson, error: lessonError } = await admin.from("lessons").insert({ class_id: klass.id, title: "Động từ mỗi ngày", description: "18 từ cơ bản", status: "published", published_at: new Date().toISOString() }).select("id").single();
  if (lessonError || !lesson) throw lessonError ?? new Error("Không tạo được bài học kiểm thử");
  lessonId = lesson.id;
  await admin.from("cards").insert([
    { lesson_id: lessonId, kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học, học hỏi", example_ja: "毎日、日本語を学びます。", example_vi: "Tôi học tiếng Nhật mỗi ngày.", position: 0 },
    { lesson_id: lessonId, kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ご飯を食べます。", example_vi: "Tôi ăn sáng.", position: 1 },
  ]);
  const { data: draft, error: draftError } = await admin.from("lessons").insert({ class_id: classId, title: "Bản nháp để xem thử", status: "draft" }).select("id").single();
  if (draftError || !draft) throw draftError ?? new Error("Không tạo được bài nháp kiểm thử");
  draftLessonId = draft.id;
  const { data: draftCards, error: draftCardsError } = await admin.from("cards").insert([
    { lesson_id: draftLessonId, kanji: "読む", hiragana: "よむ", meaning_vi: "đọc", example_ja: "本を読みます。", example_vi: "Tôi đọc sách.", position: 0 },
    { lesson_id: draftLessonId, kanji: "書く", hiragana: "かく", meaning_vi: "viết", example_ja: "手紙を書きます。", example_vi: longExample, position: 1 },
  ]).select("id");
  if (draftCardsError || !draftCards) throw draftCardsError ?? new Error("Không tạo được thẻ bản nháp kiểm thử");
  draftCardIds = draftCards.map((card) => card.id);
  const { data: emptyLesson, error: emptyError } = await admin.from("lessons").insert({ class_id: classId, title: "Bài học trống", status: "draft" }).select("id").single();
  if (emptyError || !emptyLesson) throw emptyError ?? new Error("Không tạo được bài học trống kiểm thử");
  emptyLessonId = emptyLesson.id;
});

test.afterAll(async () => {
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  await Promise.all(createdUsers.map((id) => admin.auth.admin.deleteUser(id)));
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  const status = await page.evaluate(async ({ email, password }) => (await fetch("/api/test-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).status, { email, password });
  expect(status).toBe(200);
}

test("teacher, student and study surfaces render from authenticated data", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name === "mobile" ? "-mobile" : "";

  await login(page, teacherEmail);
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { name: /Chào/ })).toBeVisible();
  await expect(page.getByText("Tên lớp học", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/teacher${suffix}.png`, fullPage: true });

  await page.goto(`/teacher/classes/${classId}/lessons/${lessonId}`);
  await expect(page.getByText("Sửa nội dung thẻ", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Lên" }).first()).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/editor${suffix}.png`, fullPage: true });

  await page.getByRole("button", { name: "Đổi tên buổi học: Động từ mỗi ngày" }).click();
  await page.getByRole("textbox", { name: "Tên buổi học" }).fill("Động từ N5");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Động từ N5" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Đổi tên buổi học: Động từ N5" })).toBeVisible();

  const authoring = page.getByRole("complementary");
  await authoring.getByLabel("Kanji", { exact: true }).fill("見る");
  await authoring.getByLabel("Hiragana", { exact: true }).fill("みる");
  await authoring.getByLabel("Nghĩa tiếng Việt", { exact: true }).fill("nhìn");
  await authoring.getByLabel("Ví dụ tiếng Nhật", { exact: true }).fill("映画を見ます。");
  await authoring.getByLabel("Bản dịch", { exact: true }).fill("Tôi xem phim.");
  await authoring.getByRole("button", { name: "Thêm thẻ" }).click();
  let newCard = page.locator("article").filter({ hasText: "見る" });
  await expect(newCard).toBeVisible();

  await newCard.getByText("Sửa nội dung thẻ", { exact: true }).click();
  await newCard.getByLabel("Nghĩa tiếng Việt", { exact: true }).fill("xem, nhìn");
  await newCard.getByRole("button", { name: "Lưu thay đổi" }).click();
  newCard = page.locator("article").filter({ hasText: "見る" });
  await expect(newCard.getByText("xem, nhìn", { exact: true })).toBeVisible();
  await newCard.getByRole("button", { name: "Lên" }).click();

  newCard = page.locator("article").filter({ hasText: "見る" });
  const editor = newCard.locator("details");
  if ((await editor.getAttribute("open")) === null) await newCard.getByText("Sửa nội dung thẻ", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await newCard.getByRole("button", { name: "Xóa thẻ" }).click();
  await expect(page.locator("article").filter({ hasText: "見る" })).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, studentEmail);
  await page.goto("/student");
  await expect(page.getByText("2 thẻ đến hạn", { exact: false })).toBeVisible();
  await page.screenshot({ path: `.impeccable/review/student${suffix}.png`, fullPage: true });

  await page.goto(`/study/${lessonId}`);
  await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
  await expect(page.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
  await expect(page.getByText("まなぶ", { exact: true })).toBeVisible();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `.impeccable/review/study${suffix}.png`, fullPage: true });
});

test("admin switches between the real student and teacher workspaces", async ({ page }) => {
  await login(page, developerEmail);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("button", { name: "Học sinh" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Giáo viên" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("button", { name: "Giáo viên" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Học sinh" }).click();
  await expect(page).toHaveURL(/\/student$/);
});

test("teacher previews draft and published lessons without writing student progress", async ({ page }, testInfo) => {
  await login(page, teacherEmail);
  await page.goto(`/teacher/classes/${classId}/lessons/${draftLessonId}`);
  await page.getByRole("link", { name: "Xem demo tiết học" }).click();
  await expect(page).toHaveURL(new RegExp(`/preview/${draftLessonId}$`));
  await expect(page.getByText("Xem thử · Không lưu kết quả")).toBeVisible();
  await expect(page.getByText("読む", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
  await expect(page.getByText("よむ", { exact: true })).toBeVisible();
  expect(await page.locator(".flip-stage").ariaSnapshot()).toContain("よむ");
  await page.waitForTimeout(750);
  await page.screenshot({ path: `.impeccable/review/preview-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /Đúng, phím 3/ }).click();
  await expect(page.getByText("書く", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Hoàn tác, phím U/ }).click();
  await expect(page.getByText("よむ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Sai, phím 1/ }).click();
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
  await expect(page.getByText(longExample, { exact: true })).toBeVisible();
  await page.waitForTimeout(750);
  const cardBounds = await page.locator(".flip-stage").boundingBox();
  const exampleBounds = await page.getByText(longExample, { exact: true }).boundingBox();
  expect(cardBounds && exampleBounds && exampleBounds.y + exampleBounds.height <= cardBounds.y + cardBounds.height).toBe(true);
  if (testInfo.project.name === "mobile") expect(cardBounds!.height).toBeGreaterThan(430);
  await page.screenshot({ path: `.impeccable/review/preview-long-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /Chưa chắc, phím 2/ }).click();
  await expect(page.getByRole("heading", { name: "Đã xem hết thẻ." })).toBeVisible();
  await page.getByRole("button", { name: "Xem lại từ đầu" }).click();
  await expect(page.getByText("読む", { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("よむ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Đúng, phím 3/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("書く", { exact: true })).toBeVisible();

  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  const [{ count: progressCount, error: progressError }, { count: reviewCount, error: reviewError }] = await Promise.all([
    admin.from("card_progress").select("card_id", { count: "exact", head: true }).in("card_id", draftCardIds),
    admin.from("review_logs").select("id", { count: "exact", head: true }).in("card_id", draftCardIds),
  ]);
  if (progressError || reviewError) throw progressError ?? reviewError;
  expect(progressCount).toBe(0);
  expect(reviewCount).toBe(0);

  await page.goto(`/teacher/classes/${classId}/lessons/${lessonId}`);
  await page.getByRole("link", { name: "Xem demo tiết học" }).click();
  await expect(page).toHaveURL(new RegExp(`/preview/${lessonId}$`));
  await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
  await page.goto(`/teacher/classes/${classId}/lessons/${emptyLessonId}`);
  await expect(page.getByRole("link", { name: "Xem demo tiết học" })).toHaveCount(0);
  await page.goto(`/preview/${emptyLessonId}`);
  await expect(page.getByRole("heading", { name: "Chưa có thẻ để xem thử" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, studentEmail);
  await page.goto(`/preview/${draftLessonId}`);
  await expect(page).toHaveURL(/\/student$/);

  await page.context().clearCookies();
  await login(page, otherTeacherEmail);
  await page.goto(`/preview/${draftLessonId}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});
