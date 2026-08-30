import { test, expect } from "@playwright/test";
import { resetBackend, ADMIN_KEY_HEADER } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Reorder-Konfiguration kann pausiert und wieder aufgenommen werden", async ({
  page,
}) => {
  // Config direkt über die API anlegen und genehmigen, um den Test auf den
  // eigentlichen UI-Teil (Pause/Resume) zu fokussieren
  await fetch(`${BACKEND_URL}/reorder/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      color: "red",
      minimum_stock: 10,
      safety_stock: 5,
      order_quantity: 15,
    }),
  });
  await fetch(`${BACKEND_URL}/reorder/red/approve`, {
    method: "PATCH",
    headers: ADMIN_KEY_HEADER,
  });

  await page.goto("/admin/system");

  const row = page.locator("tr", { hasText: "red" });
  await expect(row.getByText("Active")).toBeVisible();

  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row.getByText("Paused")).toBeVisible();

  await row.getByRole("button", { name: "Resume" }).click();
  await expect(row.getByText("Active")).toBeVisible();
});

test("Reorder-Konfiguration kann per 'End' endgültig beendet werden", async ({
  page,
}) => {
  // Config direkt über die API anlegen und genehmigen, Fokus liegt auf dem
  // "End"-Button, der bisher durch keinen Test abgedeckt war
  await fetch(`${BACKEND_URL}/reorder/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      color: "blue",
      minimum_stock: 10,
      safety_stock: 5,
      order_quantity: 15,
    }),
  });
  await fetch(`${BACKEND_URL}/reorder/blue/approve`, {
    method: "PATCH",
    headers: ADMIN_KEY_HEADER,
  });

  await page.goto("/admin/system");

  const row = page.locator("tr", { hasText: "blue" });
  await expect(row.getByText("Active")).toBeVisible();

  await row.getByRole("button", { name: "End" }).click();

  // Beendete Configs (status "cancelled") tauchen in dieser Tabelle gar
  // nicht mehr auf (sie zeigt nur "active"/"paused", siehe ReorderConfigSection)
  await expect(page.locator("tr", { hasText: "blue" })).toHaveCount(0);
  await expect(
    page.getByText("No active reorder configurations"),
  ).toBeVisible();
});
