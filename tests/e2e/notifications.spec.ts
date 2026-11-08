import { expect, test } from "@playwright/test";
import { closeTestDatabase, createTestUser, deleteTestUsers, loginAsUser, testQuery } from "./helpers/local-auth";

test.skip(process.env.RUN_AUTH_E2E !== "1", "Requires the isolated local PostgreSQL stack");

const stamp = crypto.randomUUID();
const teacherEmail = `notification-teacher-${stamp}@example.test`;
const studentEmail = `notification-student-${stamp}@example.test`;
const className = "Lớp mời học thử";
const userIds: string[] = [];
let studentId = "";

test.beforeAll(async () => {
  userIds.push(await createTestUser(teacherEmail, "teacher"));
  studentId = await createTestUser(studentEmail, "student");
  userIds.push(studentId);
  const classId = (await testQuery<{ id: string }>("INSERT INTO public.classes (teacher_id,name) VALUES ($1,$2) RETURNING id", [userIds[0], className])).rows[0].id;
  await testQuery("INSERT INTO public.class_invitations (class_id,invited_by,email) VALUES ($1,$2,$3)", [classId, userIds[0], studentEmail]);
});

test.afterAll(async () => {
  await deleteTestUsers(userIds);
  await closeTestDatabase();
});

test("student opens a pending invitation from the notification link", async ({ page }) => {
  await loginAsUser(page, studentId);

  await page.goto("/student");
  await page.getByRole("link", { name: /Thông báo/ }).click();
  await expect(page).toHaveURL(/\/student\/notifications$/);
  await expect(page.getByRole("heading", { name: className })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tham gia" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect.soft(nav.getByRole("link", { name: /Thông báo/ })).toHaveAttribute("aria-current", "page");
  await expect.soft(nav.getByRole("link", { name: "Bài học" })).not.toHaveClass(/(^|\s)bg-surface-strong(\s|$)/);
  let releaseNavigation!: () => void;
  const navigationGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  await page.route("**/student?*", async (route) => {
    await navigationGate;
    await route.continue();
  });
  try {
    await nav.getByRole("link", { name: "Bài học" }).click();
    await expect.soft(nav.getByRole("status", { name: "Đang mở trang" })).toBeVisible({ timeout: 1000 });
  } finally {
    releaseNavigation();
  }
  await expect(page.getByRole("heading", { name: "Hôm nay học gì?" })).toBeVisible();
  await expect.soft(nav.getByRole("link", { name: "Bài học" })).toHaveAttribute("aria-current", "page");
  await expect.soft(nav.getByRole("link", { name: /Thông báo/ })).not.toHaveClass(/(^|\s)bg-surface-strong(\s|$)/);
  await page.unroute("**/student?*");
  await page.goBack();
  await expect(nav.getByRole("link", { name: /Thông báo/ })).toHaveAttribute("aria-current", "page");
});
