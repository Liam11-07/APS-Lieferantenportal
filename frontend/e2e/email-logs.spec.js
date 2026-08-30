import { test, expect } from "@playwright/test";
import { resetBackend } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("Email-Logs werden nach Bestellungen korrekt angezeigt", async ({
  page,
}) => {
  // Jede erfolgreiche Bestellung löst intern log_email() aus (order_service.py),
  // unabhängig davon ob der eigentliche Mailversand klappt oder fehlschlägt
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 5 }),
  });
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "blue", quantity: 5 }),
  });

  await page.goto("/admin/system");

  // getByRole statt getByText, da der ResetSection-Beschreibungstext
  // ("...deliveries, and email logs...") "Email Logs" sonst als Teilstring
  // ebenfalls träfe
  await expect(page.getByRole("heading", { name: "Email Logs" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("order confirmation").first()).toBeVisible();
});

test("Einzelnes Email-Log kann ausgewählt und gelöscht werden, ohne andere zu betreffen", async ({
  page,
}) => {
  const order1 = await (
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "red", quantity: 5 }),
    })
  ).json();
  const order2 = await (
    await fetch(`${BACKEND_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: "blue", quantity: 5 }),
    })
  ).json();

  await page.goto("/admin/system");

  const row1 = page.locator("tr", { hasText: `#${order1.id}` });
  const row2 = page.locator("tr", { hasText: `#${order2.id}` });

  await row1.getByRole("checkbox").check();
  await expect(page.getByText("1 selected")).toBeVisible();

  await page.getByRole("button", { name: "Delete Selected (1)" }).click();

  await expect(row1).toHaveCount(0);
  await expect(row2).toBeVisible();
});

test("Mehrere Email-Logs können per 'Select All' ausgewählt und gemeinsam gelöscht werden", async ({
  page,
}) => {
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "red", quantity: 5 }),
  });
  await fetch(`${BACKEND_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color: "blue", quantity: 5 }),
  });

  await page.goto("/admin/system");
  await expect(page.locator("tbody tr")).toHaveCount(2);

  // Checkbox im Tabellenkopf wählt alle Zeilen der aktuellen Seite aus
  await page.locator("thead").getByRole("checkbox").check();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: "Delete Selected (2)" }).click();

  await expect(page.getByText("No emails sent yet")).toBeVisible();
});
