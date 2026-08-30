import { test, expect } from "@playwright/test";
import { resetBackend, colorCard } from "./helpers.js";

test.beforeEach(async () => {
  await resetBackend();
});

test("Kunde kann eine Auto-Reorder-Anfrage mit Standardwerten stellen", async ({
  page,
}) => {
  await page.goto("/order");

  // index=1: auf /order taucht "red" zuerst in der WorkpieceCard auf,
  // die ReorderCard ist das zweite Vorkommen (siehe helpers.js)
  const card = colorCard(page, "red", 1);

  // Ohne bestehende Config ist die Karte direkt im Bearbeitungsmodus mit
  // sinnvollen Default-Werten (Minimum 10, Safety 5, Qty 20) vorausgefüllt
  await card.getByRole("button", { name: "Submit for Approval" }).click();

  await expect(card.getByText("Pending Approval")).toBeVisible();
  await expect(card.getByRole("button", { name: "Edit Request" })).toBeVisible();
});

test("Kunde kann eigene Werte für die Auto-Reorder-Anfrage eintragen", async ({
  page,
}) => {
  await page.goto("/order");
  const card = colorCard(page, "blue", 1);

  await card.getByPlaceholder("Minimum").fill("25");
  await card.getByPlaceholder("Safety").fill("10");
  await card.getByPlaceholder("Reorder Qty").fill("30");
  await card.getByRole("button", { name: "Submit for Approval" }).click();

  await expect(card.getByText("Pending Approval")).toBeVisible();
  await expect(card.getByText(/Min 25/)).toBeVisible();
  await expect(card.getByText(/Safety 10/)).toBeVisible();
  await expect(card.getByText(/Qty 30/)).toBeVisible();
});

test("Submit-Button bleibt deaktiviert, wenn die Reorder-Menge leer ist", async ({
  page,
}) => {
  // order_quantity muss > 0 sein (siehe schemas/reorder_config.py Field(..., gt=0))
  // - die UI verhindert das clientseitig schon vor dem Absenden.
  // Hinweis: eine "0" eintippen funktioniert dafür nicht als Testfall - in
  // ReorderCard.handlePositiveChange() wird der Wert per
  // "Math.max(1, parseInt(val) || 1)" berechnet, und "0 || 1" ergibt wegen
  // JS-Falsy-Zero 1, d.h. eine getippte "0" wird automatisch zu 1 korrigiert.
  // Ein leeres Feld triggert die Validierung dagegen zuverlässig.
  await page.goto("/order");
  const card = colorCard(page, "white", 1);

  await card.getByPlaceholder("Reorder Qty").fill("");

  await expect(
    card.getByText(
      "Minimum and safety stock must be 0 or greater, reorder quantity must be at least 1.",
    ),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Submit for Approval" }),
  ).toBeDisabled();
});
