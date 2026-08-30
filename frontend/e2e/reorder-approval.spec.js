import { test, expect } from "@playwright/test";
import { resetBackend, colorCard } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Admin kann eine offene Reorder-Anfrage genehmigen", async ({ page }) => {
  // Anfrage über die API stellen (steht danach auf "pending"), um den Test
  // auf den Genehmigungs-UI-Teil im Admin-Bereich zu fokussieren
  await fetch(`${BACKEND_URL}/reorder/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      color: "blue",
      minimum_stock: 15,
      safety_stock: 5,
      order_quantity: 25,
    }),
  });

  await page.goto("/admin/orders");

  await expect(
    page.getByText("Pending Auto-Reorder Requests (1)"),
  ).toBeVisible();
  await expect(page.getByText(/blue.*Min 15.*Safety 5.*Qty 25/)).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).click();

  // Nach Genehmigung verschwindet das Pending-Panel, da keine offenen
  // Anfragen mehr existieren
  await expect(page.getByText(/Pending Auto-Reorder Requests/)).toHaveCount(0);

  // Genehmigte Konfiguration muss jetzt in der Inventory-Verwaltung auftauchen
  await page.goto("/admin/inventory");
  const card = colorCard(page, "blue");
  await expect(card.getByText("15", { exact: true })).toBeVisible();
  await expect(card.getByText("25", { exact: true })).toBeVisible();
});

test("Admin kann eine offene Reorder-Anfrage ablehnen", async ({ page }) => {
  await fetch(`${BACKEND_URL}/reorder/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      color: "white",
      minimum_stock: 10,
      safety_stock: 5,
      order_quantity: 10,
    }),
  });

  await page.goto("/admin/orders");
  await expect(
    page.getByText("Pending Auto-Reorder Requests (1)"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reject" }).click();

  await expect(page.getByText(/Pending Auto-Reorder Requests/)).toHaveCount(0);

  // Abgelehnte Konfiguration gilt als "cancelled" - Inventory zeigt daher
  // wieder "kein Antrag vorhanden" statt der (abgelehnten) Werte
  await page.goto("/admin/inventory");
  const card = colorCard(page, "white");
  await expect(
    card.getByText("No reorder request submitted by customer yet"),
  ).toBeVisible();
});
