import { test, expect } from "@playwright/test";
import { resetBackend, orderRow, ADMIN_KEY_HEADER } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Kunde kann eine offene Bestellung in der Bestellhistorie stornieren", async ({
  page,
}) => {
  // Bestellung direkt über die API anlegen, um den Test auf den eigentlichen
  // Stornierungs-UI-Teil zu fokussieren (analog zu reorder.spec.js)
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "blue", quantity: 10 }),
  });

  await page.goto("/history");

  const row = orderRow(page, "blue");
  await expect(row.getByText("open")).toBeVisible();

  await row.getByRole("button", { name: "Cancel" }).click();

  await expect(row.getByText("cancelled")).toBeVisible();
  // Nach der Stornierung darf kein Cancel-Button mehr angeboten werden
  await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("Eine bereits gelieferte Bestellung kann nicht storniert werden", async ({
  page,
}) => {
  // Bestellung anlegen und sofort ausliefern, damit sie den Status
  // "delivered" hat, bevor die Order-History-Seite geladen wird
  const order = await (
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "white", quantity: 5 }),
    })
  ).json();
  await fetch(`${BACKEND_URL}/deliveries/${order.id}`, {
    method: "POST",
    headers: ADMIN_KEY_HEADER,
  });

  await page.goto("/history");

  const row = orderRow(page, "white");
  await expect(row.getByText("delivered")).toBeVisible();
  // Für gelieferte Bestellungen bietet die UI gar keinen Cancel-Button an
  await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("Admin kann eine offene Bestellung auch direkt auf der Admin-Orders-Seite stornieren", async ({
  page,
}) => {
  // Eigener Cancel-Handler in AdminOrders.jsx (nicht derselbe Button wie in
  // OrderHistory.jsx) - bisher nur der Kunden-Weg oben getestet
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 8 }),
  });

  await page.goto("/admin/orders");

  const row = orderRow(page, "red");
  await expect(row.getByText("open")).toBeVisible();

  await row.getByRole("button", { name: "Cancel" }).click();

  await expect(row.getByText("cancelled")).toBeVisible();
  await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Deliver" })).toHaveCount(0);
});
