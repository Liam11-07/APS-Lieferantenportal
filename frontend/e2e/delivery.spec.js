import { test, expect } from "@playwright/test";
import { resetBackend, colorCard, orderRow } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Admin kann eine offene Bestellung ausliefern, Bestand ändert sich sichtbar", async ({
  page,
}) => {
  // Bestellung über die API anlegen, um den Test auf den Deliver-UI-Teil
  // zu fokussieren; Ausgangsbestand nach Reset: supplier=100, customer=0
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "white", quantity: 20 }),
  });

  await page.goto("/admin/orders");
  const row = orderRow(page, "white");
  await expect(row.getByText("open")).toBeVisible();

  await row.getByRole("button", { name: "Deliver" }).click();

  await expect(row.getByText("delivered")).toBeVisible();
  // Nach Lieferung verschwinden Deliver/Cancel-Buttons für diese Zeile
  await expect(row.getByRole("button", { name: "Deliver" })).toHaveCount(0);

  // Bestand muss sich sichtbar verschoben haben: supplier -20, customer +20
  // StockBar formatiert den Wert als "{zahl} pcs.", daher hier ebenso matchen
  await page.goto("/admin/inventory");
  const card = colorCard(page, "white");
  await expect(card.getByText("80 pcs.", { exact: true })).toBeVisible();
  await expect(card.getByText("20 pcs.", { exact: true })).toBeVisible();
});

test("Lieferung ist blockiert, wenn nicht genug physischer Bestand vorhanden ist", async ({
  page,
}) => {
  // Backorder-Limit erlaubt eine Bestellung über dem physischen Bestand
  // (100 + 50 Backorder-Puffer = 150), die Lieferung selbst darf serverseitig
  // und schon in der UI nicht möglich sein, solange nicht genug physischer
  // Bestand (supplier_stock) da ist
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 120 }),
  });

  await page.goto("/admin/orders");
  const row = orderRow(page, "red");

  await expect(
    row.getByText("Not enough stock — restock or cancel"),
  ).toBeVisible();
  await expect(row.getByRole("button", { name: "Deliver" })).toBeDisabled();

  // Bestand darf sich dadurch nicht verändert haben
  await page.goto("/admin/inventory");
  const card = colorCard(page, "red");
  await expect(card.getByText("100 pcs.", { exact: true })).toBeVisible();
});
