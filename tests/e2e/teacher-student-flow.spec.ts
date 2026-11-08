import { startFlashcards } from "./helpers/study";
import { expect, test as base, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { closeTestDatabase, createTestUser, deleteTestUsers, loginAsUser, testQuery } from "./helpers/local-auth";

type Actors = {
  teacher: Page;
  student: Page;
  studentEmail: string;
};

const test = base.extend<{ actors: Actors }>({
  actors: async ({ page, browser }, provide, testInfo) => {
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
      userIds.push(await createTestUser(teacherEmail, "teacher", "Mai Sensei"));
      userIds.push(await createTestUser(studentEmail, "student", "Huy Student"));
      const student = await studentContext.newPage();
      await loginAsUser(page, userIds[0]);
      await loginAsUser(student, userIds[1]);
      await provide({ teacher: page, student, studentEmail });
    } finally {
      await studentContext.close();
      await deleteTestUsers(userIds);
      await closeTestDatabase();
    }
  },
});

test.skip(process.env.RUN_AUTH_E2E !== "1", "Requires the isolated local PostgreSQL stack");

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

test("teacher imports CSV files and pasted CSV atomically and keeps existing cards", async ({ actors }) => {
  const { teacher, student, studentEmail } = actors;
  const { classPath, lessonPath } = await createClassAndLesson(teacher, "Lớp nhập CSV", "Từ vựng CSV");
  await addCard(teacher, { kanji: "学ぶ", hiragana: "まなぶ", meaning: "học", exampleJa: "日本語を学びます。", exampleVi: "Tôi học tiếng Nhật." });
  await teacher.getByText("Nhập từ CSV", { exact: true }).click();
  const panel = teacher.locator("details").filter({ has: teacher.getByText("Nhập từ CSV", { exact: true }) });
  const header = "kanji,hiragana,meaning_vi,example_ja,example_vi";
  const fileRow = '食べる,たべる,"ăn, dùng bữa",朝ご飯を食べます。,Tôi ăn sáng.';
  const invalid = "書く,,viết,手紙を書きます。,Tôi viết thư.";
  await panel.getByLabel("Chọn tệp CSV (.csv)").setInputFiles({ name: "cards.csv", mimeType: "text/csv", buffer: Buffer.from(`${header}\n${fileRow}\n${invalid}`) });
  await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
  await expect(panel.getByRole("alert")).toContainText("Hàng 3: Thiếu hiragana");
  await expect(teacher.locator("article")).toHaveCount(1);

  await panel.getByLabel("Chọn tệp CSV (.csv)").setInputFiles({ name: "cards.csv", mimeType: "text/csv", buffer: Buffer.from(`\uFEFF${header}\r\n${fileRow}\r\n`) });
  await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
  await expect(panel.getByRole("status")).toHaveText("Đã nhập 1 thẻ.");
  await expect(teacher.locator("article")).toHaveCount(2);
  await expect(panel.getByLabel("Chọn tệp CSV (.csv)")).toHaveValue("");

  await panel.getByRole("radio", { name: "Dán nội dung CSV" }).check();
  const pastedRow = '読む,よむ,"đọc, đọc sách","「本」を\n読みます。","Tôi đọc ""sách""."';
  const invalidPaste = `${header}\n${pastedRow}\n${invalid}`;
  await panel.getByRole("textbox", { name: "Nội dung CSV" }).fill(invalidPaste);
  await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
  await expect(panel.getByRole("alert")).toContainText("Hàng 4: Thiếu hiragana");
  await expect(panel.getByRole("radio", { name: "Dán nội dung CSV" })).toBeChecked();
  await expect(panel.getByRole("textbox", { name: "Nội dung CSV" })).toHaveValue(invalidPaste);
  await expect(teacher.locator("article")).toHaveCount(2);
  await panel.getByRole("radio", { name: "Tải tệp CSV", exact: true }).check();
  await panel.getByRole("radio", { name: "Dán nội dung CSV" }).check();
  await expect(panel.getByRole("textbox", { name: "Nội dung CSV" })).toHaveValue(invalidPaste);

  await panel.getByRole("textbox", { name: "Nội dung CSV" }).fill(`${header}\n${pastedRow}`);
  await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
  await expect(panel.getByRole("status")).toHaveText("Đã nhập 1 thẻ.");
  await expect(panel.getByRole("textbox", { name: "Nội dung CSV" })).toHaveValue("");
  await teacher.reload();
  await expect(teacher.locator("article")).toHaveCount(3);
  await expect(teacher.locator("article").locator("p.font-jp.text-2xl")).toHaveText(["学ぶ", "食べる", "読む"]);
  await expect(teacher.getByText("ăn, dùng bữa", { exact: true })).toBeVisible();
  await expect(teacher.getByText('Tôi đọc "sách".', { exact: true })).toBeVisible();
  await expect(teacher.getByText("Bản nháp", { exact: true })).toBeVisible();

  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();
  await sendInvitation(teacher, classPath, studentEmail);
  await openInvitation(student, "Lớp nhập CSV");
  await student.getByRole("button", { name: "Tham gia" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await student.goto(`/study/${lessonPath.split("/").at(-1)}`);
  await expect(student.getByText("ăn, dùng bữa", { exact: true })).toBeVisible();
  await expect(student.getByText('Tôi đọc "sách".', { exact: true })).toBeVisible();
});

test("CSV authoring fits phone and desktop viewports in both themes", async ({ actors }, testInfo) => {
  test.setTimeout(120_000);
  const { teacher } = actors;
  await createClassAndLesson(teacher, "Lớp kiểm tra CSV", "Từ vựng mỗi ngày");
  await addCard(teacher, { kanji: "学ぶ", hiragana: "まなぶ", meaning: "học, học hỏi", exampleJa: "毎日、日本語を学びます。", exampleVi: "Tôi học tiếng Nhật mỗi ngày." });
  const viewports = testInfo.project.name === "desktop"
    ? [{ width: 320, height: 760 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1440, height: 1000 }]
    : [{ width: 390, height: 844 }];
  const sample = 'kanji,hiragana,meaning_vi,example_ja,example_vi\n読む,よむ,"đọc, đọc sách",本を読みます。,Tôi đọc sách.';
  for (const viewport of viewports) {
    await teacher.setViewportSize(viewport);
    for (const colorScheme of ["light", "dark"] as const) {
      await teacher.emulateMedia({ colorScheme });
      await teacher.reload();
      await teacher.getByText("Nhập từ CSV", { exact: true }).click();
      const panel = teacher.locator("details").filter({ has: teacher.getByText("Nhập từ CSV", { exact: true }) });
      const name = `${testInfo.project.name}-${viewport.width}x${viewport.height}-${colorScheme}`;
      const assertFits = async () => {
        expect(await teacher.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        const controls = panel.locator('input:not([type="hidden"]):visible, textarea:visible, button');
        for (const control of await controls.all()) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          if (!box) throw new Error("CSV control has no visible bounds");
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        }
        const button = await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).boundingBox();
        expect(button?.height).toBeGreaterThanOrEqual(44);
      };
      await assertFits();
      await teacher.screenshot({ path: `.impeccable/review/csv/${name}-file.png`, fullPage: true, caret: "initial" });
      await panel.getByRole("radio", { name: "Dán nội dung CSV" }).check();
      await panel.getByRole("textbox", { name: "Nội dung CSV" }).fill(sample);
      await assertFits();
      await panel.screenshot({ path: `.impeccable/review/csv/${name}-text.png`, caret: "initial" });
      const invalid = `${sample}\n書く,,viết,手紙を書きます。,Tôi viết thư.`;
      await panel.getByRole("textbox", { name: "Nội dung CSV" }).fill(invalid);
      await panel.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
      await expect(panel.getByRole("alert")).toContainText("Hàng 3: Thiếu hiragana");
      await expect(panel.getByRole("radio", { name: "Dán nội dung CSV" })).toBeChecked();
      await expect(panel.getByRole("textbox", { name: "Nội dung CSV" })).toHaveValue(invalid);
      await assertFits();
      await panel.screenshot({ path: `.impeccable/review/csv/${name}-error.png`, caret: "initial" });
    }
  }
});

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
    await student.getByLabel("Xem nhóm thẻ").selectOption(source === "Excel" ? "hard" : "again");
    await expect(student.getByText(source === "Excel" ? "学ぶ" : "食べる", { exact: true })).toBeVisible();
    await expect(student.getByText(source === "Excel" ? "食べる" : "学ぶ", { exact: true })).toHaveCount(0);
    await student.getByRole("button", { name: "Trắc nghiệm" }).first().click();
    await expect(student.getByLabel("Từ vựng để học")).toHaveValue(source === "Excel" ? "hard" : "again");
    await student.getByRole("button", { name: "Hủy" }).click();
    await student.getByRole("link", { name: "Trở về lớp" }).click();
    await expect.soft(student.getByRole("link", { name: new RegExp(lessonTitle) })).toContainText(source === "Excel" ? "Hiện chưa có thẻ đến hạn" : "1 thẻ đến hạn");

    await teacher.goto(classPath);
    const progress = teacher.getByRole("row").filter({ hasText: studentEmail });
    await expect(progress.getByRole("cell").nth(1)).toHaveText("2/2");
    await expect(progress.getByRole("cell").nth(2)).toHaveText(source === "Excel" ? "0" : "1");
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

test("student creates and studies a private classroom lesson visible only to its creator and teacher", async ({ actors, browser }, testInfo) => {
  test.setTimeout(180_000);
  const { teacher, student, studentEmail } = actors;
  const { classPath } = await createClassAndLesson(teacher, "Lớp bài học cá nhân", "Bài chung của lớp");
  await addCard(teacher, { kanji: "学ぶ", hiragana: "まなぶ", meaning: "học", exampleJa: "日本語を学びます。", exampleVi: "Tôi học tiếng Nhật." });
  await teacher.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(teacher.getByText("Đã xuất bản", { exact: true })).toBeVisible();
  await sendInvitation(teacher, classPath, studentEmail);
  await openInvitation(student, "Lớp bài học cá nhân");
  await student.getByRole("button", { name: "Tham gia" }).click();
  await expect(student.getByRole("heading", { name: "Không có thông báo mới" })).toBeVisible();
  await student.goto("/student");
  await student.getByRole("link", { name: "Tạo bài học cá nhân" }).click();
  await expect(student).toHaveURL(/\/student\/classes\/[0-9a-f-]+\/lessons\/new$/);
  const newPath = new URL(student.url()).pathname;
  await expect(student.getByRole("heading", { name: "Tạo bài học cá nhân" })).toBeVisible();
  await student.getByRole("textbox", { name: "Tên bài" }).fill("Từ vựng riêng của tôi");
  await student.getByRole("button", { name: "Tạo bài", exact: true }).click();
  await expect(student).toHaveURL(/\/student\/classes\/[0-9a-f-]+\/lessons\/[0-9a-f-]+$/);
  const editorPath = new URL(student.url()).pathname;
  const lessonId = editorPath.split("/").at(-1);
  await expect(student.getByText("Bài học cá nhân. Chỉ học viên tạo bài và giáo viên của lớp có thể xem.")).toBeVisible();
  await student.getByRole("button", { name: "Đổi tên buổi học: Từ vựng riêng của tôi" }).click();
  await student.getByRole("textbox", { name: "Tên buổi học" }).fill("Từ vựng riêng đã đổi tên");
  await student.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(student.getByRole("button", { name: "Đổi tên buổi học: Từ vựng riêng đã đổi tên" })).toBeVisible();
  await student.getByRole("button", { name: "Đổi tên buổi học: Từ vựng riêng đã đổi tên" }).click();
  await student.getByRole("textbox", { name: "Tên buổi học" }).fill("Từ vựng riêng của tôi");
  await student.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(student.getByRole("button", { name: "Đổi tên buổi học: Từ vựng riêng của tôi" })).toBeVisible();
  await student.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(student.getByRole("alert").filter({ hasText: "Cần ít nhất một thẻ" })).toBeVisible();
  await addCard(student, { kanji: "読む", hiragana: "よむ", meaning: "đọc", exampleJa: "本を読みます。", exampleVi: "Tôi đọc sách." });
  await student.getByText("Nhập từ Excel", { exact: true }).click();
  await uploadWorkbook(student, [headers, ...excelCards]);
  await expect(student.getByRole("status").filter({ hasText: "Đã nhập 2 thẻ." })).toBeVisible();
  await student.getByText("Nhập từ CSV", { exact: true }).click();
  const csv = student.locator("details").filter({ has: student.getByText("Nhập từ CSV", { exact: true }) });
  await csv.getByRole("radio", { name: "Dán nội dung CSV" }).check();
  await csv.getByRole("textbox", { name: "Nội dung CSV" }).fill("kanji,hiragana,meaning_vi,example_ja,example_vi\n書く,かく,viết,手紙を書きます。,Tôi viết thư.");
  await csv.getByRole("button", { name: "Kiểm tra và nhập CSV" }).click();
  await expect(csv.getByRole("status")).toHaveText("Đã nhập 1 thẻ.");
  await expect(student.locator("article")).toHaveCount(4);
  const lastCard = student.locator("article").last();
  await lastCard.getByRole("button", { name: "Lên", exact: true }).click();
  await expect(student.locator("article").locator("p.font-jp.text-2xl")).toHaveText(["読む", "学ぶ", "書く", "食べる"]);
  await student.locator("article").first().getByText("Sửa nội dung thẻ", { exact: true }).click();
  await student.locator("article").first().getByRole("textbox", { name: "Nghĩa tiếng Việt" }).fill("đọc sách");
  await student.locator("article").first().getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(student.locator("article").first().getByText("đọc sách", { exact: true })).toBeVisible();
  await student.goto("/student");
  await expect(student.getByText("Từ vựng riêng của tôi", { exact: true })).toBeVisible();
  await expect(student.getByText("Bài học cá nhân · Bản nháp · Chỉ bạn và giáo viên", { exact: true })).toBeVisible();
  await teacher.goto(classPath);
  await expect(teacher.getByRole("link", { name: /Từ vựng riêng của tôi/ })).toBeVisible();

  const peerContext = await browser.newContext();
  const peerId = await createTestUser(`private-peer-${crypto.randomUUID()}@example.test`, "student", "Peer Student");
  try {
    const peer = await peerContext.newPage();
    await loginAsUser(peer, peerId);
    // Enroll a second student in the same class, so rejection proves privacy rather than lack of membership.
    await testQuery("INSERT INTO public.class_memberships(class_id,student_id) VALUES ($1,$2)", [classPath.split("/").at(-1), peerId]);
    for (const published of [false, true]) {
      if (published) {
        await student.goto(editorPath);
        await student.getByRole("button", { name: "Xuất bản", exact: true }).click();
        await expect(student.getByText("Đã xuất bản", { exact: true })).toBeVisible();
      }
      await peer.goto("/student");
      await expect(peer.getByText("Bài chung của lớp", { exact: true })).toBeVisible();
      await expect(peer.getByText("Từ vựng riêng của tôi", { exact: true })).toHaveCount(0);
      await peer.goto(editorPath);
      await expect(peer.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
      await peer.goto(`/study/${lessonId}`);
      await expect(peer.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    }
    await student.goto(`/study/${lessonId}`);
    await expect(student.getByRole("heading", { name: "Từ vựng riêng của tôi", exact: true })).toBeVisible();
    await student.getByRole("button", { name: "Thẻ ghi nhớ", exact: true }).first().click();
    await student.getByRole("checkbox", { name: "Học tất cả" }).uncheck();
    await student.getByRole("spinbutton", { name: "Số thẻ trong phiên" }).fill("1");
    await student.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await student.getByRole("button", { name: /Đúng, phím 3/ }).click();
    await expect(student.getByRole("heading", { name: "Đã hoàn thành phiên học." })).toBeVisible();
    await teacher.goto(classPath);
    const creatorProgress = teacher.getByRole("row").filter({ hasText: "Huy Student" });
    const peerProgress = teacher.getByRole("row").filter({ hasText: "Peer Student" });
    await expect(creatorProgress).toContainText("1/5");
    await expect(peerProgress).toContainText("0/1");
    await teacher.getByRole("link", { name: /Từ vựng riêng của tôi/ }).click();
    await expect(teacher.getByText("đọc sách", { exact: true })).toBeVisible();
    await teacher.getByRole("link", { name: "Xem demo tiết học" }).click();
    await expect(teacher.getByRole("heading", { name: "Từ vựng riêng của tôi", exact: true })).toBeVisible();

    const viewports = testInfo.project.name === "desktop"
      ? [{ width: 320, height: 760 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1440, height: 1000 }]
      : [{ width: 390, height: 844 }];
    for (const viewport of viewports) {
      await student.setViewportSize(viewport);
      await teacher.setViewportSize(viewport);
      for (const colorScheme of ["light", "dark"] as const) {
        await student.emulateMedia({ colorScheme });
        await teacher.emulateMedia({ colorScheme });
        const name = `${testInfo.project.name}-${viewport.width}x${viewport.height}-${colorScheme}`;
        const capture = async (page: Page, label: string) => {
          const headings: Record<string, string> = { create: "Tạo bài học cá nhân", dashboard: "Hôm nay học gì?", editor: "Từ vựng riêng của tôi", teacher: "Lớp bài học cá nhân" };
          if (label === "editor") await expect(page.getByRole("button", { name: "Đổi tên buổi học: Từ vựng riêng của tôi" })).toBeVisible();
          else await expect(page.getByRole("heading", { name: headings[label], exact: true })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
          await page.screenshot({ path: `.impeccable/review/personal-lessons/${name}-${label}.png`, fullPage: true, caret: "initial" });
        };
        await student.goto(newPath);
        await capture(student, "create");
        await student.goto("/student");
        await expect(student.getByText("Bài học cá nhân · Đã xuất bản · Chỉ bạn và giáo viên")).toBeVisible();
        await capture(student, "dashboard");
        await student.goto(editorPath);
        await student.locator("article").first().getByText("Sửa nội dung thẻ", { exact: true }).click();
        await student.getByText("Nhập từ CSV", { exact: true }).click();
        await capture(student, "editor");
        await teacher.goto(classPath);
        await capture(teacher, "teacher");
      }
    }
  } finally {
    await peerContext.close();
    await deleteTestUsers([peerId]);
  }
});
