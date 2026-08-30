import { test, expect } from "@playwright/test";
import { resetBackend, colorCard } from "./helpers.js";

test.beforeEach(async () => {
  await resetBackend();
});

test("Kunde kann eine Bestellung erfolgreich aufgeben", async ({ page }) => {
  await page.goto("/order");

  const card = colorCard(page, "blue");
  await card.locator('input[type="number"]').fill("5");
  await card.getByRole("button", { name: "Order" }).click();

  // Button zeigt kurz den Erfolgszustand, bevor er nach 3s zurückspringt
  await expect(card.getByRole("button", { name: "✓ Ordered!" })).toBeVisible();

  // Bestellung muss tatsächlich im Backend gelandet sein und in der
  // Bestellhistorie als offene Bestellung auftauchen
  await page.goto("/history");
  const row = page.locator("tr", { hasText: "blue" });
  await expect(row.getByText("open")).toBeVisible();
});

test("Bestellung über dem Backorder-Limit wird mit Fehlermeldung abgelehnt", async ({
  page,
}) => {
  // Regel (order_service.py): max_orderable = supplier_stock + max(supplier_stock*0.5, 20)
  // Bei frischem supplier_stock=100 also 150 - 200 muss daher scheitern
  await page.goto("/order");

  const card = colorCard(page, "red");
  await card.locator('input[type="number"]').fill("200");
  await card.getByRole("button", { name: "Order" }).click();

  await expect(card.getByText(/exceeds allowed backorder limit/i)).toBeVisible();

  // Es darf keine Bestellung angelegt worden sein
  await page.goto("/history");
  await expect(page.getByText("No orders found")).toBeVisible();
});

test("Order-Button ist deaktiviert, solange keine gültige Menge eingegeben ist", async ({
  page,
}) => {
  // Clientseitige Absicherung gegen leere/0-Mengen, bevor überhaupt eine
  // Anfrage ans Backend geschickt wird
  await page.goto("/order");

  const card = colorCard(page, "white");
  await card.locator('input[type="number"]').fill("");

  await expect(card.getByRole("button", { name: "Order" })).toBeDisabled();
});
