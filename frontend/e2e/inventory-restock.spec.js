import { test, expect } from "@playwright/test";
import { resetBackend, colorCard } from "./helpers.js";

test.beforeEach(async () => {
  await resetBackend();
});

test("Admin kann den Lieferantenbestand manuell aufstocken (Restock)", async ({
  page,
}) => {
  await page.goto("/admin/inventory");

  const card = colorCard(page, "red");
  await expect(card.getByText("100 pcs.", { exact: true })).toBeVisible();

  await card.getByPlaceholder("Amount").fill("50");
  await card.getByRole("button", { name: "Restock" }).click();

  // Erfolgsbestätigung erscheint kurz auf dem Button
  await expect(card.getByRole("button", { name: "✓ Added" })).toBeVisible();
  // Bestand ist tatsächlich gestiegen: 100 + 50 = 150
  await expect(card.getByText("150 pcs.", { exact: true })).toBeVisible();
});

test("Restock-Button bleibt deaktiviert bei leerer oder 0-Menge", async ({
  page,
}) => {
  // restock_inventory() im Backend lehnt Mengen <= 0 ab - die UI verhindert
  // das schon clientseitig, bevor eine Anfrage rausgeht
  await page.goto("/admin/inventory");

  const card = colorCard(page, "blue");
  await expect(card.getByRole("button", { name: "Restock" })).toBeDisabled();

  await card.getByPlaceholder("Amount").fill("0");
  await expect(card.getByRole("button", { name: "Restock" })).toBeDisabled();
});
