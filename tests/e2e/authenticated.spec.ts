import { expect, test } from "@playwright/test";
import { startFlashcards } from "./helpers/study";
import { closeTestDatabase, createTestUser, deleteTestUsers, loginAsUser, testQuery } from "./helpers/local-auth";

const enabled = process.env.RUN_AUTH_E2E === "1";
test.skip(!enabled, "Requires the isolated local PostgreSQL stack");

const stamp = crypto.randomUUID();
const teacherEmail = `ui-teacher-${stamp}@example.test`;
const studentEmail = `ui-student-${stamp}@example.test`;
const developerEmail = `ui-admin-${stamp}@example.test`;
const otherTeacherEmail = `ui-other-teacher-${stamp}@example.test`;
const createdUsers: string[] = [];
const userIdsByEmail = new Map<string, string>();
let classId = "";
let lessonId = "";
let draftLessonId = "";
let emptyLessonId = "";
let cardIds: string[] = [];
let draftCardIds: string[] = [];
const longExample = "Tôi viết một lá thư rất dài. ".repeat(15).trim();

test.beforeAll(async () => {
  for (const [email, role] of [[teacherEmail, "teacher"], [studentEmail, "student"], [developerEmail, "admin"], [otherTeacherEmail, "teacher"]] as const) {
    const id = await createTestUser(email, role, role === "teacher" ? "Mai Sensei" : "Huy", role === "admin" ? "student" : null);
    createdUsers.push(id);
    userIdsByEmail.set(email, id);
  }
  classId = (await testQuery<{ id: string }>("INSERT INTO public.classes (teacher_id,name,description) VALUES ($1,$2,$3) RETURNING id", [createdUsers[0], "Tên lớp học", "Từ vựng N5 dùng mỗi ngày"])).rows[0].id;
  await testQuery("INSERT INTO public.class_memberships (class_id,student_id) VALUES ($1,$2)", [classId, createdUsers[1]]);
  lessonId = (await testQuery<{ id: string }>("INSERT INTO public.lessons (class_id,title,description,status,published_at) VALUES ($1,$2,$3,'published',now()) RETURNING id", [classId, "Động từ mỗi ngày", "18 từ cơ bản"])).rows[0].id;
  cardIds = (await testQuery<{ id: string }>(`INSERT INTO public.cards (lesson_id,kanji,hiragana,meaning_vi,example_ja,example_vi,position) VALUES
    ($1,'学ぶ','まなぶ','học, học hỏi','毎日、日本語を学びます。','Tôi học tiếng Nhật mỗi ngày.',0),
    ($1,'食べる','たべる','ăn','朝ご飯を食べます。','Tôi ăn sáng.',1) RETURNING id`, [lessonId])).rows.map((card) => card.id);
  draftLessonId = (await testQuery<{ id: string }>("INSERT INTO public.lessons (class_id,title,status) VALUES ($1,'Bản nháp để xem thử','draft') RETURNING id", [classId])).rows[0].id;
  draftCardIds = (await testQuery<{ id: string }>(`INSERT INTO public.cards (lesson_id,kanji,hiragana,meaning_vi,example_ja,example_vi,position) VALUES
    ($1,'読む','よむ','đọc','本を読みます。','Tôi đọc sách.',0),
    ($1,'書く','かく','viết','手紙を書きます。',$2,1) RETURNING id`, [draftLessonId, longExample])).rows.map((card) => card.id);
  emptyLessonId = (await testQuery<{ id: string }>("INSERT INTO public.lessons (class_id,title,status) VALUES ($1,'Bài học trống','draft') RETURNING id", [classId])).rows[0].id;
});

test.afterAll(async () => {
  await deleteTestUsers(createdUsers);
  await closeTestDatabase();
});

async function login(page: import("@playwright/test").Page, email: string) {
  const userId = userIdsByEmail.get(email);
  if (!userId) throw new Error("The test user was not prepared.");
  await loginAsUser(page, userId);
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

  await testQuery(`INSERT INTO public.card_progress (student_id,card_id,due_at) VALUES
    ($1,$3,'2000-01-01T00:00:00Z'),($1,$4,'2100-01-01T00:00:00Z'),($2,$3,'2100-01-01T00:00:00Z')`,
  [createdUsers[1], createdUsers[2], cardIds[0], cardIds[1]]);
  await page.reload();
  await expect(page.getByRole("link", { name: /1 thẻ đến hạn.*2 thẻ tất cả/ })).toBeVisible();

  await page.goto(`/study/${lessonId}`);
  await expect(page.getByRole("heading", { name: "Từ vựng trong bài" })).toBeVisible();
  await expect(page.getByText("食べる", { exact: true })).toHaveCount(0);
  await page.getByLabel("Xem nhóm thẻ").selectOption("all");
  await expect(page.getByText("食べる", { exact: true })).toBeVisible();
  await page.getByLabel("Xem nhóm thẻ").selectOption("due");
  await startFlashcards(page);
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).click();
  await expect(page.getByRole("button", { name: /Đúng, phím 3/ })).toBeEnabled();
  await expect(page.getByText("まなぶ", { exact: true })).toBeVisible();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `.impeccable/review/study${suffix}.png`, fullPage: true });

  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && new URL(route.request().url()).origin === new URL(page.url()).origin) {
      await saveGate;
    }
    await route.continue();
  });
  const activeCard = page.locator(".flip-stage:not([aria-hidden])");
  const bounds = await activeCard.boundingBox();
  if (!bounds) throw new Error("Study card is not visible");
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 70, centerY, { steps: 8 });
  await page.mouse.up();
  try {
    await expect(page.getByRole("status")).toHaveText("Đang lưu thay đổi…");
    await expect(page.getByText("Đang lưu thẻ cuối…")).toBeVisible();
    const exitedCard = await activeCard.evaluate((element) => element.getBoundingClientRect().left);
    expect(exitedCard).toBeGreaterThan(page.viewportSize()!.width);
    if (testInfo.project.name === "desktop") {
      await page.mouse.wheel(500, 0);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    }
    await page.screenshot({ path: `.impeccable/review/study-swipe-saving-${testInfo.project.name}.png`, fullPage: true });
  } finally {
    releaseSave();
  }
  await expect(page.getByRole("heading", { name: "Đã hoàn thành phiên học." })).toBeVisible();
  await page.getByRole("button", { name: "Hoàn tác thẻ cuối" }).click();
  await expect(page.getByText("まなぶ", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Học sinh" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Học sinh" })).toHaveAttribute("aria-pressed", "true");
});

test("teacher previews draft and published lessons without writing student progress", async ({ page }, testInfo) => {
  await login(page, teacherEmail);
  await page.goto(`/teacher/classes/${classId}/lessons/${draftLessonId}`);
  await page.getByRole("link", { name: "Xem demo tiết học" }).click();
  await expect(page).toHaveURL(new RegExp(`/preview/${draftLessonId}$`));
  await expect(page.getByText("Xem thử · Không lưu kết quả")).toBeVisible();
  await expect(page.getByText("読む", { exact: true })).toBeVisible();
  await startFlashcards(page);
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const originalViewport = page.viewportSize();
    for (const [width, height] of [[320, 760], [1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.locator(".flip-stage")).toBeVisible();
      await expect(page.getByRole("button", { name: /Sai, phím 1/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Đúng, phím 3/ })).toBeVisible();
      if (width === 320) {
        const card = await page.locator(".flip-stage").boundingBox();
        const controls = await page.locator(".answer-controls").boundingBox();
        expect(card && controls && card.y + card.height <= controls.y + 1).toBe(true);
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `.impeccable/review/study-swipe-${width}.png`, fullPage: true });
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
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

  await page.getByRole("button", { name: /Sai, phím 1/ }).click();
  await page.getByRole("button", { name: "Xem lại từ đầu" }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const dragCard = async (distance: number) => {
    const bounds = await page.locator(".flip-stage").boundingBox();
    if (!bounds) throw new Error("Study card is not visible");
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + distance, y, { steps: 8 });
    await page.mouse.up();
  };
  const watchSwipeExit = async () => {
    await page.evaluate(() => {
      delete document.documentElement.dataset.swipeExit;
      const card = document.querySelector<HTMLElement>(".flip-stage:not([aria-hidden])");
      const recordExit = (event: Event) => {
        if (event.target === card && (event as TransitionEvent).propertyName === "transform" && card?.classList.contains("is-exiting")) {
          const bounds = card.getBoundingClientRect();
          document.documentElement.dataset.swipeExit = JSON.stringify({ left: bounds.left, right: bounds.right });
          card.removeEventListener("transitionend", recordExit);
        }
      };
      card?.addEventListener("transitionend", recordExit);
    });
  };
  await dragCard(45);
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(page.locator(".flip-stage")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.getByRole("button", { name: "Lật thẻ để xem đáp án" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("よむ", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await watchSwipeExit();
  await dragCard(70);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.swipeExit ?? "")).not.toBe("");
  const rightExit = JSON.parse((await page.evaluate(() => document.documentElement.dataset.swipeExit))!);
  expect(rightExit.left).toBeGreaterThan(page.viewportSize()!.width);
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await watchSwipeExit();
  await dragCard(-70);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.swipeExit ?? "")).not.toBe("");
  const leftExit = JSON.parse((await page.evaluate(() => document.documentElement.dataset.swipeExit))!);
  expect(leftExit.right).toBeLessThan(0);
  await expect(page.getByRole("heading", { name: "Đã xem hết thẻ." })).toBeVisible();

  const [{ rows: progressCount }, { rows: reviewCount }] = await Promise.all([
    testQuery<{ count: string }>("SELECT count(*)::text AS count FROM public.card_progress WHERE card_id=ANY($1::uuid[])", [draftCardIds]),
    testQuery<{ count: string }>("SELECT count(*)::text AS count FROM public.review_logs WHERE card_id=ANY($1::uuid[])", [draftCardIds]),
  ]);
  expect(Number(progressCount[0].count)).toBe(0);
  expect(Number(reviewCount[0].count)).toBe(0);

  await page.goto(`/teacher/classes/${classId}/lessons/${lessonId}`);
  await page.getByRole("link", { name: "Xem demo tiết học" }).click();
  await expect(page).toHaveURL(new RegExp(`/preview/${lessonId}$`));
  await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
  await page.goto(`/teacher/classes/${classId}/lessons/${emptyLessonId}`);
  await expect(page.getByRole("link", { name: "Xem demo tiết học" })).toHaveCount(0);
  await page.goto(`/preview/${emptyLessonId}`);
  await expect(page.getByRole("heading", { name: "Bài học chưa có từ vựng" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, studentEmail);
  await page.goto(`/preview/${draftLessonId}`);
  await expect(page).toHaveURL(/\/student$/);

  await page.context().clearCookies();
  await login(page, otherTeacherEmail);
  await page.goto(`/preview/${draftLessonId}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

test("vocabulary, centered setup and scored practice work in both themes without changing review history", async ({ page }, testInfo) => {
  async function savedProgress() {
    const [progress, logs] = await Promise.all([
      testQuery("SELECT * FROM public.card_progress WHERE student_id=$1 AND card_id=ANY($2::uuid[]) ORDER BY card_id", [createdUsers[1], cardIds]),
      testQuery("SELECT * FROM public.review_logs WHERE student_id=$1 AND card_id=ANY($2::uuid[]) ORDER BY id", [createdUsers[1], cardIds]),
    ]);
    return { progress: progress.rows, logs: logs.rows };
  }
  await login(page, studentEmail);
  const before = await savedProgress();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`/study/${lessonId}`);
    await expect(page.getByRole("heading", { name: "Từ vựng trong bài" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lật thẻ để xem đáp án" })).toHaveCount(0);
    await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
    if (testInfo.project.name === "desktop" && theme === "light") {
      const originalViewport = page.viewportSize();
      for (const [width, height] of [[320, 760], [1440, 900], [1920, 1080]] as const) {
        await page.setViewportSize({ width, height });
        const scope = page.getByLabel("Xem nhóm thẻ");
        await expect(scope).toBeVisible();
        const box = await scope.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: `.impeccable/review/schedule-due-${width}.png`, fullPage: true });
        await scope.selectOption("all");
        await expect(page.getByText("食べる", { exact: true })).toBeVisible();
        await page.screenshot({ path: `.impeccable/review/schedule-all-${width}.png`, fullPage: true });
        await page.getByRole("button", { name: "Thẻ ghi nhớ" }).first().click();
        await expect(page.getByRole("dialog", { name: "Thẻ ghi nhớ" })).toBeVisible();
        await page.screenshot({ path: `.impeccable/review/schedule-setup-${width}.png`, fullPage: true });
        await page.getByRole("button", { name: "Hủy" }).click();
        await scope.selectOption("due");
      }
      if (originalViewport) await page.setViewportSize(originalViewport);
    }
    await page.getByLabel("Xem nhóm thẻ").selectOption("all");
    await expect(page.getByText("食べる", { exact: true })).toBeVisible();
    const screenshot = (name: string) => page.screenshot({ path: `.impeccable/review/lesson-flow/${testInfo.project.name}-${theme}-${name}.png`, fullPage: true });
    await screenshot("overview");

    const bottomPicker = page.getByRole("region", { name: "Chế độ học cuối danh sách" });
    const trigger = bottomPicker.getByRole("button", { name: "Trắc nghiệm" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Trắc nghiệm" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await dialog.getByLabel("Chiều học").selectOption("back-first");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");

    await page.getByRole("region", { name: "Chế độ học đầu danh sách" }).getByRole("button", { name: "Trắc nghiệm" }).click();
    await expect(dialog.getByLabel("Chiều học")).toHaveValue("back-first");
    await dialog.getByLabel("Chiều học").selectOption("front-first");
    await dialog.getByLabel("Tráo thứ tự câu hỏi").uncheck();
    for (const control of await dialog.getByRole("combobox").all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height - 30);
    await dialog.getByRole("heading").scrollIntoViewIfNeeded();
    await screenshot("setup");
    await dialog.getByRole("button", { name: "Bắt đầu" }).click();
    await expect(page.getByRole("heading", { name: "学ぶ", exact: true })).toBeVisible();
    await screenshot("quiz");
    const options = page.getByRole("group", { name: "Các đáp án" });
    await expect(options.getByRole("button")).toHaveCount(2);
    await options.getByRole("button", { name: "học, học hỏi", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Chính xác!");
    await expect(options.getByRole("button").first()).toHaveAttribute("aria-disabled", "true");
    await screenshot("feedback");
    await page.getByRole("button", { name: "Tiếp theo" }).click();
    await options.getByRole("button", { name: "học, học hỏi", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Chưa đúng.");
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByText("1 / 2 câu đúng", { exact: true })).toBeVisible();
    await screenshot("results");
    await page.getByRole("button", { name: "Làm bài mới" }).click();
    await expect(dialog.getByLabel("Tráo thứ tự câu hỏi")).not.toBeChecked();
    await dialog.getByRole("button", { name: "Hủy" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await startFlashcards(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Từ vựng trong bài" })).toBeVisible();
  }
  expect(await savedProgress()).toEqual(before);

  await page.context().clearCookies();
  await login(page, studentEmail);
  await page.goto(`/study/${draftLessonId}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

test("an open lesson updates its due list when a scheduled card becomes due", async ({ page }) => {
  const dueAt = new Date(Date.now() + 10_000).toISOString();
  await testQuery(`INSERT INTO public.card_progress (student_id,card_id,due_at,last_rating) VALUES
    ($1,$2,'2000-01-01T00:00:00Z','again'),($1,$3,$4,'hard')
    ON CONFLICT (student_id,card_id) DO UPDATE SET due_at=EXCLUDED.due_at,last_rating=EXCLUDED.last_rating`,
  [createdUsers[1], cardIds[0], cardIds[1], dueAt]);
  await login(page, studentEmail);
  await page.goto(`/study/${lessonId}`);
  await expect(page.getByText("1 thẻ đến hạn hoặc chưa học")).toBeVisible();
  await expect(page.getByText("食べる", { exact: true })).toHaveCount(0);
  await expect(page.getByText("2 thẻ đến hạn hoặc chưa học")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("食べる", { exact: true })).toBeVisible();
});
