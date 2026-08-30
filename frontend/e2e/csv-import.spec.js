import { test, expect } from "@playwright/test";
import { resetBackend, orderRow, ADMIN_KEY_HEADER } from "./helpers.js";

const BACKEND_URL = "http://localhost:8000";

test.beforeEach(async () => {
  await resetBackend();
});

test("CSV-Import: gültige Datei wird komplett erfolgreich importiert", async ({
  page,
}) => {
  await page.goto("/order");

  const csv = "color,quantity\nred,5\nblue,3\nwhite,2\n";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "orders.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

  await expect(page.getByText("Confirm Order")).toBeVisible();
  await expect(
    page.getByText("✓ All orders are valid and ready to be placed."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page.getByText("✓ 3 successful")).toBeVisible();
  await expect(page.getByText(/failed/)).toHaveCount(0);

  // Alle drei Bestellungen müssen tatsächlich angelegt worden sein
  await page.goto("/history");
  await expect(orderRow(page, "red")).toBeVisible();
  await expect(orderRow(page, "blue")).toBeVisible();
  await expect(orderRow(page, "white")).toBeVisible();
});

test("CSV-Import: gültige Zeilen werden trotz fehlerhafter Zeilen importiert", async ({
  page,
}) => {
  // "green" existiert nicht im Inventar - csv_service.py fängt das pro Zeile
  // ab, ohne den gesamten Import abzubrechen (siehe process_csv())
  await page.goto("/order");

  const csv = "color,quantity\nred,5\ngreen,5\n";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "orders.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

  // Hinweis: die "...Valid orders will still be processed"-Variante der
  // Meldung setzt hasWarnings voraus, das aber in PlaceOrder.jsx nie true
  // werden kann (validateRow() vergleicht gegen item.minimum_stock - ein
  // Feld, das auf dem Inventory-Objekt gar nicht existiert). Erreichbar ist
  // daher nur die einfache "insufficient stock"-Meldung.
  await expect(
    page.getByText("Some orders cannot be placed due to insufficient stock."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Order Valid Items" }).click();

  await expect(page.getByText("✓ 1 successful")).toBeVisible();
  await expect(page.getByText("✗ 1 failed")).toBeVisible();
  await expect(page.getByText(/Row 2.*not found/)).toBeVisible();

  // Nur die gültige rote Bestellung darf tatsächlich angelegt worden sein
  await page.goto("/history");
  await expect(orderRow(page, "red")).toBeVisible();
  await expect(page.getByText("No orders found")).toHaveCount(0);
});

test("CSV-Import: gültige Zeile, die Bestand unter Reorder-Schwelle drückt, zeigt Warnung", async ({
  page,
}) => {
  // Aktive Reorder-Config für "white" anlegen: Schwelle = minimum_stock(80)
  // + safety_stock(10) = 90. Zeile "white,15" ist für sich genommen gültig
  // (15 <= supplier_stock 100), drückt den Bestand danach aber auf 85 < 90
  // -> genau der hasWarnings-Zweig in validateRow() (PlaceOrder.jsx), der
  // erst seit der Kopplung an aktive ReorderConfigs erreichbar ist.
  await fetch(`${BACKEND_URL}/reorder/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      color: "white",
      minimum_stock: 80,
      safety_stock: 10,
      order_quantity: 20,
    }),
  });
  await fetch(`${BACKEND_URL}/reorder/white/approve`, {
    method: "PATCH",
    headers: ADMIN_KEY_HEADER,
  });

  await page.goto("/order");

  const csv = "color,quantity\nwhite,15\n";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "orders.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

  await expect(
    page.getByText(
      "⚠ Some orders will cause stock to fall below minimum level. You can still proceed.",
    ),
  ).toBeVisible();
  // Kein Fehler, also weiterhin der normale "Place Order"-Button (nicht
  // "Order Valid Items", das ist dem Fehler-Zweig vorbehalten)
  await expect(page.getByRole("button", { name: "Place Order" })).toBeVisible();

  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(page.getByText("✓ 1 successful")).toBeVisible();
});

test("CSV-Import: Datei ohne gültige Zeilen zeigt Hinweis statt Bestell-Option", async ({
  page,
}) => {
  await page.goto("/order");

  // Nur Kopfzeile ohne Datenzeilen -> Frontend findet keine Zeilen zum Parsen
  const csv = "color,quantity\n";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "empty.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

  await expect(page.getByText("No valid rows found in CSV")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place Order" })).toHaveCount(0);
});
