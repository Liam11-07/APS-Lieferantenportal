import { test, expect } from "@playwright/test";
import { resetBackend } from "./helpers.js";

test.beforeEach(async () => {
  await resetBackend();
});

// Hinweis: Es gibt im Code keine Umschaltung zwischen Kunden- und
// Admin-Bereich (App.jsx definiert zwei getrennte Routen-Bäume mit je
// eigener Navbar, siehe CustomerLayout.jsx/AdminLayout.jsx) - daher wird
// hier direkte URL-Erreichbarkeit statt eines UI-Switchers getestet.

test("Alle Kunden-Routen sind über die Navbar erreichbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Place Order" }).click();
  await expect(page).toHaveURL(/\/order$/);
  await expect(page.getByRole("heading", { name: "Place Order" })).toBeVisible();

  await page.getByRole("link", { name: "Order History" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "Order History" })).toBeVisible();

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("Alle Admin-Routen sind über die Navbar erreichbar", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(
    page.getByRole("heading", { name: "Inventory Management" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

  await page.getByRole("link", { name: "System" }).click();
  await expect(page).toHaveURL(/\/admin\/system$/);
  // exact: true, da die Seite auch ein "Reset System"-Unter-Heading enthält
  await expect(
    page.getByRole("heading", { name: "System", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
});

test("Alle Haupt-Routen sind auch per direktem Deep-Link erreichbar", async ({
  page,
}) => {
  const routes = [
    { path: "/", heading: "Overview" },
    { path: "/order", heading: "Place Order" },
    { path: "/history", heading: "Order History" },
    { path: "/admin", heading: "Admin Dashboard" },
    { path: "/admin/inventory", heading: "Inventory Management" },
    { path: "/admin/orders", heading: "All Orders" },
    { path: "/admin/system", heading: "System" },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    // exact: true, da /admin/system zusätzlich ein "Reset System"-Heading
    // enthält, das "System" sonst als Teilstring auch träfe
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }),
    ).toBeVisible();
  }
});

test("Unbekannte Route zeigt eine 'Page not found'-Seite statt einer leeren Fläche", async ({
  page,
}) => {
  await page.goto("/this-route-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back to Overview" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
