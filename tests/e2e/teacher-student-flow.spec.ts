import { startFlashcards } from "./helpers/study";
import { expect, test as base, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

type Actors = {
  teacher: Page;
  student: Page;
  studentEmail: string;
};

const password = "Local-test-only-123!";
const apiUrl = process.env.TEST_SUPABASE_URL ?? "";
const secretKey = process.env.TEST_SUPABASE_SECRET_KEY ?? "";

const test = base.extend<{ actors: Actors }>({
  actors: async ({ page, browser }, provide, testInfo) => {
    const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
    const stamp = crypto.randomUUID();
    const teacherEmail = `flow-teacher-${stamp}@example.test`;
    const studentEmail = `flow-student-${stamp}@example.test`;
    const userIds: string[] = [];
    const mobile = testInfo.project.name === "mobile";
    const studentContext = await browser.newContext({
      viewport: page.viewportSize() ?? undefined,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      for (const [email, role, name] of [[teacherEmail, "teacher", "Mai Sensei"], [studentEmail, "student", "Huy Student"]] as const) {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
        if (error) throw error;
        userIds.push(data.user.id);
        const { error: profileError } = await admin.from("profiles").update({ role, onboarding_completed_at: new Date().toISOString() }).eq("id", data.user.id);
        if (profileError) throw profileError;
      }
      const student = await studentContext.newPage();
      await login(page, teacherEmail);
      await login(student, studentEmail);
      await provide({ teacher: page, student, studentEmail });
    } finally {
      await studentContext.close();
      for (const id of userIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      }
    }
  },
});

test.skip(process.env.RUN_AUTH_E2E !== "1", "Requires the isolated local Supabase stack");

async function login(page: Page, email: string) {
  await page.goto("/");
  const status = await page.evaluate(async ({ email, password }) =>
    (await fetch("/api/test-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).status,
  { email, password });
  expect(status).toBe(200);
}

async function createClassAndLesson(teacher: Page, className: string, lessonTitle: string) {
  await teacher.goto("/teacher");
  await teacher.getByRole("textbox", { name: "Tên lớp" }).fill(className);
  await teacher.getByRole("button", { name: "Tạo lớp" }).click();
  await expect(teacher).toHaveURL(/\/teacher\/classes\/[0-9a-f-]+$/);
  const classPath = new URL(teacher.url()).pathname;

  await teacher.getByRole("textbox", { name: "Tên bài" }).fill(lessonTitle);
  await teacher.getByRole("button", { name: "Tạo bài" }).click();
  await expect(teacher).toHaveURL(/\/teacher\/classes\/[0-9a-f-]+\/lessons\/[0-9a-f-]+$/);
  return { classPath, lessonPath: new URL(teacher.url()).pathname };
}

async function addCard(teacher: Page, card: { kanji: string; hiragana: string; meaning: string; exampleJa: string; exampleVi: string }) {
  const authoring = teacher.getByRole("complementary");
  await authoring.getByRole("textbox", { name: "Kanji" }).fill(card.kanji);
  await authoring.getByRole("textbox", { name: "Hiragana" }).fill(card.hiragana);
  await authoring.getByRole("textbox", { name: "Nghĩa tiếng Việt" }).fill(card.meaning);
  await authoring.getByRole("textbox", { name: "Ví dụ tiếng Nhật" }).fill(card.exampleJa);
  await authoring.getByRole("textbox", { name: "Bản dịch" }).fill(card.exampleVi);
  await authoring.getByRole("button", { name: "Thêm thẻ" }).click();
  await expect(teacher.locator("article").filter({ hasText: card.kanji })).toBeVisible();
}

const headers = ["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"];
const excelCards = [
  ["学ぶ", "まなぶ", "học", "日本語を学びます。", "Tôi học tiếng Nhật."],
  ["食べる", "たべる", "ăn", "朝ご飯を食べます。", "Tôi ăn sáng."],
];

async function uploadWorkbook(teacher: Page, rows: ExcelJS.CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Thẻ học");
  rows.forEach((row) => sheet.addRow(row));
  const bytes = await workbook.xlsx.writeBuffer();
  await teacher.getByRole("complementary").getByLabel("Chọn tệp Excel (.xlsx)").setInputFiles({
    name: "lesson-cards.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(bytes),
  });
  await teacher.getByRole("button", { name: "Kiểm tra và nhập thẻ" }).click();
}

async function sendInvitation(teacher: Page, classPath: string, studentEmail: string) {
  await teacher.goto(classPath);
  await teacher.getByRole("textbox", { name: "Email học viên" }).fill(studentEmail);
  await teacher.getByRole("button", { name: "Mời", exact: true }).click();
  await expect(teacher.getByRole("status")).toContainText(`Đã mời ${studentEmail}`);
}

async function openInvitation(student: Page, className: string) {
  await student.goto("/student");
  await expect(student.getByRole("link", { name: /1 lời mời lớp học mới/ })).toBeVisible();
  await student.getByRole("link", { name: /Thông báo/ }).click();
  await expect(student.getByRole("heading", { name: className })).toBeVisible();
}

for (const source of ["manual", "Excel"] as const) {
  test(`teacher authors ${source} cards, previews, invites; student reviews; teacher sees the result`, async ({ actors }) => {
    const { teacher, student, studentEmail } = actors;
    const className = "Lớp hội thoại N5";
    const lessonTitle = "Động từ mỗi ngày";
    const { classPath, lessonPath } = await createClassAndLesson(teacher, className, lessonTitle);

    if (source === "manual") {
      await addCard(teacher, { kanji: "学ぶ", hiragana: "まなぶ", meaning: "học", exampleJa: "日本語を学びます。", exampleVi: "Tôi học tiếng Nhật." });
      await addCard(teacher, { kanji: "食べる", hiragana: "たべる", meaning: "ăn", exampleJa: "朝ご飯を食べます。", exampleVi: "Tôi ăn sáng." });
    } else {
      await teacher.getByText("Nhập từ Excel", { exact: true }).click();
      await uploadWorkbook(teacher, [headers, excelCards[0], ["書く", "", "viết", "手紙を書きます。", "Tôi viết thư."]]);
      await expect(teacher.getByText("Hàng 3: Thiếu hiragana", { exact: true })).toBeVisible();
      await expect(teacher.locator("article")).toHaveCount(0);
      await uploadWorkbook(teacher, [headers, ...excelCards]);
      await expect(teacher.locator("article").filter({ hasText: "学ぶ" })).toBeVisible();
      await expect(teacher.locator("article").filter({ hasText: "食べる" })).toBeVisible();
    }
    await teacher.getByRole("link", { name: "Xem demo tiết học" }).click();
    await expect(teacher.getByText("Xem thử · Không lưu kết quả")).toBeVisible();
    await startFlashcards(teacher);
    await teacher.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
    await teacher.getByRole("button", { name: /Đúng, phím 3/ }).click();
    await expect(teacher.getByText("食べる", { exact: true })).toBeVisible();
    await teacher.goto(lessonPath);
    await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();

    await sendInvitation(teacher, classPath, studentEmail);
    await openInvitation(student, className);
    await student.getByRole("button", { name: "Tham gia" }).click();
    await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
    await teacher.goto(classPath);
    await expect.soft(teacher.getByRole("row").filter({ hasText: studentEmail }).getByRole("cell").nth(2)).toHaveText("2");
    await student.goto("/student");
    await expect(student.getByRole("link", { name: /lời mời lớp học mới/ })).toHaveCount(0);
    await student.getByRole("link", { name: new RegExp(lessonTitle) }).click();
    await startFlashcards(student);

    await expect(student.getByText("学ぶ", { exact: true })).toBeVisible();
    await student.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
    await student.getByRole("button", { name: source === "Excel" ? /Chưa chắc, phím 2/ : /Đúng, phím 3/ }).click();
    await expect(student.getByText("食べる", { exact: true })).toBeVisible();
    await student.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
    await student.getByRole("button", { name: source === "Excel" ? /Đúng, phím 3/ : /Sai, phím 1/ }).click();
    await expect(student.getByRole("heading", { name: "Đã hoàn thành phiên học." })).toBeVisible();
    await student.getByRole("button", { name: "Quay lại bài học" }).click();
    await expect(student.getByRole("heading", { name: "Từ vựng trong bài" })).toBeVisible();
    await student.getByRole("link", { name: "Trở về lớp" }).click();
    await expect.soft(student.getByRole("link", { name: new RegExp(lessonTitle) })).toContainText("Đã học xong hôm nay");

    await teacher.goto(classPath);
    const progress = teacher.getByRole("row").filter({ hasText: studentEmail });
    await expect(progress.getByRole("cell").nth(1)).toHaveText("2/2");
    await expect(progress.getByRole("cell").nth(2)).toHaveText("0");
    await expect(progress.getByRole("cell").nth(3)).toHaveText("50%");
  });
}

test("an empty draft cannot publish and stays hidden until the teacher adds a card", async ({ actors }) => {
  const { teacher, student, studentEmail } = actors;
  const className = "Lớp nháp N5";
  const lessonTitle = "Bài học chờ xuất bản";
  const { classPath, lessonPath } = await createClassAndLesson(teacher, className, lessonTitle);

  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Cần ít nhất một thẻ trước khi xuất bản.")).toBeVisible();
  await sendInvitation(teacher, classPath, studentEmail);
  await openInvitation(student, className);
  await student.getByRole("button", { name: "Tham gia" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await student.goto("/student");
  await expect(student.getByRole("heading", { name: className })).toBeVisible();
  await expect(student.getByText("Giáo viên chưa xuất bản bài học.")).toBeVisible();
  await expect(student.getByRole("link", { name: new RegExp(lessonTitle) })).toHaveCount(0);

  await teacher.goto(lessonPath);
  await addCard(teacher, { kanji: "読む", hiragana: "よむ", meaning: "đọc", exampleJa: "本を読みます。", exampleVi: "Tôi đọc sách." });
  await student.reload();
  await expect(student.getByRole("link", { name: new RegExp(lessonTitle) })).toHaveCount(0);
  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();
  await student.reload();
  await expect(student.getByRole("link", { name: new RegExp(lessonTitle) })).toBeVisible();
  await teacher.goto(classPath);
  const progress = teacher.getByRole("row").filter({ hasText: studentEmail });
  await expect(progress.getByRole("cell").nth(1)).toHaveText("0/1");
});

test("declining an invitation keeps the student outside the class and its published lesson", async ({ actors }) => {
  const { teacher, student, studentEmail } = actors;
  const className = "Lớp từ chối N5";
  const { classPath, lessonPath } = await createClassAndLesson(teacher, className, "Bài học riêng");
  await addCard(teacher, { kanji: "書く", hiragana: "かく", meaning: "viết", exampleJa: "手紙を書きます。", exampleVi: "Tôi viết thư." });
  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();

  await sendInvitation(teacher, classPath, studentEmail);
  await openInvitation(student, className);
  await student.getByRole("button", { name: "Từ chối" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await student.goto("/student");
  await expect(student.getByRole("heading", { name: "Chưa tham gia lớp nào" })).toBeVisible();
  await student.goto(`/study/${lessonPath.split("/").at(-1)}`);
  await expect(student.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await teacher.goto(classPath);
  await expect(teacher.getByText("Chưa có học viên tham gia.")).toBeVisible();
});

test("a known student can be invited again and a revoked invitation clears the unread badge", async ({ actors }) => {
  const { teacher, student, studentEmail } = actors;
  const first = await createClassAndLesson(teacher, "Lớp đã tham gia", "Bài nháp");
  await sendInvitation(teacher, first.classPath, studentEmail);
  await openInvitation(student, "Lớp đã tham gia");
  await student.getByRole("button", { name: "Tham gia" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();

  const second = await createClassAndLesson(teacher, "Lớp mời tiếp", "Bài nháp");
  await sendInvitation(teacher, second.classPath, studentEmail);
  await teacher.getByRole("textbox", { name: "Email học viên" }).fill(studentEmail);
  await teacher.getByRole("button", { name: "Mời", exact: true }).click();
  await expect(teacher.getByRole("alert").filter({ hasText: "Email này đã có lời mời đang chờ." })).toBeVisible();
  await openInvitation(student, "Lớp mời tiếp");
  teacher.once("dialog", (dialog) => dialog.accept());
  await teacher.getByRole("button", { name: "Thu hồi", exact: true }).click();
  await expect(teacher.getByRole("button", { name: /^(Thu hồi|Đang thu hồi)$/ })).toHaveCount(0);
  await student.reload();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await expect(student.getByRole("link", { name: /Thông báo/ })).not.toHaveAccessibleName(/chưa đọc/);
});

test("reverse study saves ratings from either face and undo after shuffling updates the teacher's report", async ({ actors }) => {
  const { teacher, student, studentEmail } = actors;
  const className = "Lớp ôn tập N5";
  const lessonTitle = "Bài học hoàn tác";
  const { classPath } = await createClassAndLesson(teacher, className, lessonTitle);
  await addCard(teacher, { kanji: "聞く", hiragana: "きく", meaning: "nghe", exampleJa: "音楽を聞きます。", exampleVi: "Tôi nghe nhạc." });
  await addCard(teacher, { kanji: "話す", hiragana: "はなす", meaning: "nói", exampleJa: "日本語を話します。", exampleVi: "Tôi nói tiếng Nhật." });
  await addCard(teacher, { kanji: "読む", hiragana: "よむ", meaning: "đọc", exampleJa: "本を読みます。", exampleVi: "Tôi đọc sách." });
  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();
  await sendInvitation(teacher, classPath, studentEmail);
  await openInvitation(student, className);
  await student.getByRole("button", { name: "Tham gia" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await student.goto("/student");
  await student.getByRole("link", { name: new RegExp(lessonTitle) }).click();
    await startFlashcards(student);

  await student.getByRole("combobox", { name: "Chiều học" }).selectOption("back-first");
  await expect(student.getByText("きく", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: "Xem mặt kanji" }).click();
  await expect(student.getByText("聞く", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: /Đúng, phím 3/ }).click();
  await expect(student.getByText("はなす", { exact: true })).toBeVisible();
  await expect(student.getByText("2 / 3", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: "Tráo thẻ" }).click();
  await expect(student.getByRole("status")).toHaveText("Đã tráo 2 thẻ còn lại.");
  await student.getByRole("button", { name: /Hoàn tác, phím U/ }).click();
  await expect(student.getByText("聞く", { exact: true })).toBeVisible();
  await expect(student.getByText("1 / 3", { exact: true })).toBeVisible();
  await teacher.goto(classPath);
  const progress = teacher.getByRole("row").filter({ hasText: studentEmail });
  await expect(progress.getByRole("cell").nth(1)).toHaveText("0/3");
  await expect(progress.getByRole("cell").nth(3)).toHaveText("—");

  await student.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
  await expect(student.getByText("きく", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: /Đúng, phím 3/ }).click();
  await expect(student.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(student.getByRole("group", { name: "Mặt sau" })).toBeVisible();
  await teacher.reload();
  await expect(progress.getByRole("cell").nth(1)).toHaveText("1/3");
  await expect(progress.getByRole("cell").nth(3)).toHaveText("100%");
});
