import { test, expect } from "@playwright/test";
import { resetBackend } from "./helpers.js";

test.beforeEach(async () => {
  await resetBackend();
});

test("Reset-Modal zeigt Fehlermeldung bei falschem Key", async ({ page }) => {
  await page.goto("/admin/system");

  await page.getByRole("button", { name: "Reset System" }).click();
  // Modal-Text statt Überschrift geprüft: seit die Modal-Überschrift auf
  // "Reset System" (statt "Reset system") vereinheitlicht wurde, ist der
  // Text identisch zur Panel-Überschrift dahinter (h2) - "heading"-Suche
  // nach dem Namen wäre dadurch nicht mehr eindeutig
  await expect(
    page.getByText("This action cannot be undone"),
  ).toBeVisible();

  await page.getByPlaceholder("Dev-Reset-Key").fill("falscher-key-123");
  await page.getByRole("button", { name: "Yes, reset" }).click();

  await expect(page.getByText("Invalid key")).toBeVisible();
});

test("Reset-Modal funktioniert mit korrektem Key", async ({ page }) => {
  const realKey = process.env.DEV_RESET_KEY;

  await page.goto("/admin/system");

  await page.getByRole("button", { name: "Reset System" }).click();
  await page.getByPlaceholder("Dev-Reset-Key").fill(realKey);
  await page.getByRole("button", { name: "Yes, reset" }).click();

  await expect(page.getByText("System reset successfully")).toBeVisible();
});
