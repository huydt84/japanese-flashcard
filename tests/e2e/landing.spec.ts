import { expect, test } from "@playwright/test";

test("landing page explains the product and flips the sample card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Học từ vựng tiếng Nhật/ })).toBeVisible();
  await expect(page.getByText("学ぶ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Chạm để lật thẻ/ }).click();
  await expect(page.getByText("まなぶ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục với Google" })).toBeVisible();
});
