import { expect, type Page } from "@playwright/test";

export async function startFlashcards(page: Page) {
  await page.getByRole("button", { name: "Thẻ ghi nhớ", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Thẻ ghi nhớ" })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
