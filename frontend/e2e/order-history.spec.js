import { test, expect } from "@playwright/test";
import { resetBackend, orderRow, ADMIN_KEY_HEADER } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Bestellhistorie zeigt offene und stornierte Bestellungen korrekt an", async ({
  page,
}) => {
  // Eine offene und eine stornierte Bestellung über die API vorbereiten,
  // um gezielt die Anzeige-/Filterlogik der History-Seite zu testen
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 8 }),
  });
  const toCancel = await (
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "white", quantity: 4 }),
    })
  ).json();
  await fetch(`${BACKEND_URL}/orders/${toCancel.id}/cancel`, {
    method: "PATCH",
  });

  await page.goto("/history");

  await expect(orderRow(page, "red").getByText("open")).toBeVisible();
  await expect(orderRow(page, "white").getByText("cancelled")).toBeVisible();

  // Filter "Open" zeigt nur die offene rote Bestellung
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(orderRow(page, "red")).toBeVisible();
  await expect(orderRow(page, "white")).toHaveCount(0);

  // Filter "Cancelled" zeigt nur die stornierte weiße Bestellung
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(orderRow(page, "white")).toBeVisible();
  await expect(orderRow(page, "red")).toHaveCount(0);

  // Filter "All" zeigt wieder beide
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(orderRow(page, "red")).toBeVisible();
  await expect(orderRow(page, "white")).toBeVisible();
});

test("Bestellhistorie zeigt 'No orders found', wenn kein Eintrag zum Filter passt", async ({
  page,
}) => {
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 3 }),
  });

  await page.goto("/history");
  // Es existiert keine gelieferte Bestellung, daher darf der Filter
  // "Delivered" keine Zeilen zeigen
  await page.getByRole("button", { name: "Delivered", exact: true }).click();
  await expect(page.getByText("No orders found")).toBeVisible();
});

test("Eine tatsächlich gelieferte Bestellung taucht im 'Delivered'-Filter auf", async ({
  page,
}) => {
  // Gegenstück zum Leerfall oben: hier existiert wirklich eine gelieferte
  // Bestellung, die im Filter auch sichtbar sein muss
  const order = await (
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "blue", quantity: 5 }),
    })
  ).json();
  await fetch(`${BACKEND_URL}/deliveries/${order.id}`, {
    method: "POST",
    headers: ADMIN_KEY_HEADER,
  });

  await page.goto("/history");
  await page.getByRole("button", { name: "Delivered", exact: true }).click();

  await expect(orderRow(page, "blue").getByText("delivered")).toBeVisible();
});

test("Bestellhistorie paginiert ab mehr als 20 Einträgen korrekt", async ({
  page,
}) => {
  // PAGE_SIZE = 20 in OrderHistory.jsx - 21 Bestellungen erzeugen, um
  // Previous/Next und die Seiten-Buttons tatsächlich zu erzwingen
  for (let i = 0; i < 21; i++) {
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "red", quantity: 1 }),
    });
  }

  await page.goto("/history");

  await expect(page.getByText("Showing 1–20 of 21")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Previous" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Showing 21–21 of 21")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Showing 1–20 of 21")).toBeVisible();
});
