const BACKEND_URL = "http://localhost:8000";
const DEV_RESET_KEY = process.env.DEV_RESET_KEY;

// Admin-mutierende Routen (Deliver, Restock, Reorder-Verwaltung, Email-Logs
// löschen) sind jetzt per verify_admin_key geschützt (siehe backend/app/auth.py).
// Fallback identisch zum Backend-Default, damit Tests auch ohne gesetzte
// ADMIN_API_KEY-Umgebungsvariable laufen. Für Testaufrufe, die diese Routen
// per rohem fetch() im Setup ansprechen (nicht über die UI/api.js).
export const ADMIN_KEY_HEADER = {
  "X-API-Key": process.env.ADMIN_API_KEY || "admin-secret-key-123",
};

export async function resetBackend() {
  if (!DEV_RESET_KEY) {
    throw new Error(
      "DEV_RESET_KEY nicht gesetzt - vor dem Testlauf z.B. so exportieren: " +
        "export DEV_RESET_KEY=dein-key",
    );
  }
  const res = await fetch(`${BACKEND_URL}/dev/reset`, {
    method: "DELETE",
    headers: { "X-API-Key": DEV_RESET_KEY },
  });
  if (!res.ok) {
    throw new Error(`Reset fehlgeschlagen: ${res.status}`);
  }
}

// Findet die Karten-Kachel (WorkpieceCard auf /order, InventoryCard auf
// /admin/inventory, ReorderCard auf /order) zu einer Farbe.
// Alle drei Kartentypen zeigen den Farbnamen als eigenständiges Text-Element
// ohne weiteren Text darin ("red"/"blue"/"white" exakt), zwei DOM-Ebenen
// unterhalb des jeweiligen Karten-Containers - daher reicht ein exakter
// Text-Match plus zwei Schritte nach oben, statt CSS-Klassen zu erraten.
// Auf /order gibt es die Farbe zweimal (WorkpieceCard zuerst, ReorderCard
// danach) - deshalb der optionale index-Parameter.
export function colorCard(scope, color, index = 0) {
  return scope.getByText(color, { exact: true }).nth(index).locator("xpath=../..");
}

// Findet die Tabellenzeile einer Bestellung anhand der Farbe.
// Wichtig: nur innerhalb von <tbody> suchen (nicht die <thead>-Kopfzeile
// mit einbeziehen) UND per "has" auf das exakte Farb-Textelement filtern
// (nicht per hasText-Teilstring auf die ganze Zeile) - sonst matcht "red"
// fälschlich auch die Spaltenüberschrift/den Status-Badge "Delivered"/
// "delivered", die beide "red" als Teilstring enthalten. Ein simpler
// Wortgrenzen-Regex (\bred\b) reicht ebenfalls nicht, da Tabellenzellen
// ohne Leerzeichen aneinanderstoßen (z.B. "6blue" ohne Trenner zwischen
// Bestell-ID und Farbe), was die Wortgrenze vor der Farbe zerstört.
export function orderRow(scope, color) {
  return scope
    .locator("tbody tr")
    .filter({ has: scope.getByText(color, { exact: true }) });
}
