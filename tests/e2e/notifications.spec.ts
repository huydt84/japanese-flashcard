import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.skip(process.env.RUN_AUTH_E2E !== "1", "Requires the isolated local Supabase stack");

const apiUrl = process.env.TEST_SUPABASE_URL ?? "";
const secretKey = process.env.TEST_SUPABASE_SECRET_KEY ?? "";
const password = "Local-test-only-123!";
const stamp = crypto.randomUUID();
const teacherEmail = `notification-teacher-${stamp}@example.test`;
const studentEmail = `notification-student-${stamp}@example.test`;
const className = "Lớp mời học thử";
const userIds: string[] = [];

test.beforeAll(async () => {
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  for (const [email, role] of [[teacherEmail, "teacher"], [studentEmail, "student"]] as const) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const { error: profileError } = await admin.from("profiles").update({ role, onboarding_completed_at: new Date().toISOString() }).eq("id", data.user.id);
    if (profileError) throw profileError;
  }
  const { data: klass, error: classError } = await admin.from("classes").insert({ teacher_id: userIds[0], name: className }).select("id").single();
  if (classError || !klass) throw classError ?? new Error("Could not create the test class");
  const { error: invitationError } = await admin.from("class_invitations").insert({ class_id: klass.id, invited_by: userIds[0], email: studentEmail });
  if (invitationError) throw invitationError;
});

test.afterAll(async () => {
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
});

test("student opens a pending invitation from the notification link", async ({ page }) => {
  await page.goto("/");
  const loginStatus = await page.evaluate(async ({ email, password }) =>
    (await fetch("/api/test-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })).status, { email: studentEmail, password });
  expect(loginStatus).toBe(200);

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
