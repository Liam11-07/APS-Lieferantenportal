import { useEffect, useState } from "react";
import { api } from "../../api";

// Seite "Place Order": Kunde bestellt einzelne Werkstücke, importiert eine
// CSV-Sammelbestellung, oder verwaltet seine Auto-Reorder-Anfragen.
// Aufbau:
//   1. WorkpieceCard  - einzelne Bestellkarten pro Farbe
//   2. CSVUpload      - Batch-Import via CSV-Datei
//   3. ReorderCard    - Auto-Reorder-Anfrage pro Farbe stellen/bearbeiten

//  WorkpieceCard:
function WorkpieceSVG({ color }) {
  const colors = {
    red: { main: "#e63030", shadow: "#b71c1c", highlight: "#ef9a9a" },
    blue: { main: "#2563eb", shadow: "#1565c0", highlight: "#90caf9" },
    white: { main: "#e0e0e0", shadow: "#9e9e9e", highlight: "#ffffff" },
  };
  const c = colors[color] || colors.white;

  return (
    <svg viewBox="0 0 120 100" className="w-32 h-28 mx-auto">
      {/* Schatten */}
      <ellipse cx="60" cy="92" rx="35" ry="6" fill="rgba(0,0,0,0.10)" />
      {/* Werkstück Körper — Zylinder */}
      <ellipse cx="60" cy="30" rx="32" ry="10" fill={c.highlight} />
      <rect x="28" y="30" width="64" height="52" fill={c.main} rx="2" />
      <ellipse cx="60" cy="82" rx="32" ry="10" fill={c.shadow} />
      {/* Highlight */}
      <ellipse cx="60" cy="30" rx="32" ry="10" fill={c.main} />
      <ellipse
        cx="48"
        cy="28"
        rx="10"
        ry="4"
        fill={c.highlight}
        opacity="0.5"
      />
      {/* Bohrung oben */}
      <ellipse cx="60" cy="30" rx="10" ry="4" fill={c.shadow} />
      <ellipse cx="60" cy="30" rx="8" ry="3" fill="#1a1a18" opacity="0.6" />
    </svg>
  );
}

// Verfügbarkeitsstatus basierend auf Bestand
function StockStatus({ stock }) {
  if (stock <= 0)
    return (
      <span className="text-xs font-medium text-gray-400">Out of Stock</span>
    );
  if (stock < 10)
    return <span className="text-xs font-medium text-red-500">Almost Out</span>;
  if (stock < 50)
    return (
      <span className="text-xs font-medium text-amber-500">Low Stock</span>
    );
  return <span className="text-xs font-medium text-green-600">In Stock</span>;
}

// Backorder-Grenzwert = die Backend-Logik aus order_service.py
// (BACKORDER_PERCENT, BACKORDER_MINIMUM)
const BACKORDER_PERCENT = 0.5;
const BACKORDER_MINIMUM = 20;

// Einzelne Werkstück-Karte: zeigt Bestand + Bestellformular für eine Farbe.
// Berechnet dieselbe Backorder-Grenze wie das Backend
function WorkpieceCard({ item, onOrder, alreadyReserved }) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const outOfStock = item.supplier_stock <= 0;

  // Spiegelt order_service.py create_order() 1:1:
  // strictly_available = supplier_stock - bereits offene Bestellungen dieser Farbe
  // max_orderable = strictly_available + Backorder-Puffer
  const strictlyAvailable = item.supplier_stock - alreadyReserved;
  const backorderBuffer = Math.max(
    item.supplier_stock * BACKORDER_PERCENT,
    BACKORDER_MINIMUM,
  );
  const maxOrderable = strictlyAvailable + backorderBuffer;

  // Bestellung abschicken; onOrder() (von PlaceOrder übergeben) macht den
  // eigentlichen API-Call und wirft bei Ablehnung (z.B. Backorder-Limit
  // überschritten) einen Error mit der Backend-Fehlermeldung als Text
  async function handleOrder() {
    if (quantity <= 0 || outOfStock) return;
    setLoading(true);
    setError(null);
    try {
      await onOrder(item.color, quantity);
      setSuccess(true);
      setQuantity(1);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`bg-white border rounded-xl p-5 flex flex-col items-center gap-3 shadow-sm transition-all ${
        outOfStock
          ? "opacity-60 border-gray-200"
          : "border-gray-200 hover:shadow-md"
      }`}
    >
      {/* SVG Illustration */}
      <WorkpieceSVG color={item.color} />

      {/* Name & Status */}
      <div className="text-center">
        <div className="text-base font-semibold text-gray-800 capitalize mb-1">
          {item.color}
        </div>
        <StockStatus stock={item.supplier_stock} />
      </div>

      {/* Menge + Button */}
      <div className="w-full space-y-2 mt-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 w-16">Quantity</label>
          <input
            type="number"
            min="1"
            max={maxOrderable}
            value={quantity}
            onChange={(e) => {
              const val = e.target.value;
              setQuantity(val === "" ? "" : Math.max(0, parseInt(val) || 0));
            }}
            disabled={outOfStock}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-400 disabled:bg-gray-50"
          />
        </div>

        <button
          onClick={handleOrder}
          disabled={loading || outOfStock || quantity === "" || quantity < 1}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            outOfStock
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : success
                ? "bg-green-500 text-white"
                : "bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
          }`}
        >
          {loading
            ? "Ordering..."
            : success
              ? "✓ Ordered!"
              : outOfStock
                ? "Out of Stock"
                : "Order"}
        </button>

        {/* Fehlermeldung */}
        {error && (
          <div className="text-xs text-red-500 text-center">{error}</div>
        )}
      </div>
    </div>
  );
}

// Hauptkomponente: hält den gemeinsamen State (Inventory, Orders, ReorderConfigs)
export default function PlaceOrder() {
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getInventory(),
      api.getOrders(),
      api.getReorderConfigs(),
    ]).then(([inv, ord, configs]) => {
      setInventory(inv);
      setOrders(ord);
      setReorderConfigs(configs);
      setLoading(false);
    });
  }, []);

  async function handleOrder(color, quantity) {
    const result = await api.createOrder(color, quantity);
    if (result.detail) throw new Error(result.detail);
    // Inventory UND Orders neu laden - alreadyReserved ändert sich durch die neue Bestellung ebenfalls
    const [updatedInv, updatedOrders] = await Promise.all([
      api.getInventory(),
      api.getOrders(),
    ]);
    setInventory(updatedInv);
    setOrders(updatedOrders);
    return result;
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    );

  // Summe aller offenen (noch nicht gelieferten/stornierten) Bestellungen
  // pro Farbe - identisch zu already_reserved in order_service.py
  function getAlreadyReserved(color) {
    return orders
      .filter((o) => o.color === color && o.status === "open")
      .reduce((sum, o) => sum + o.quantity, 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Place Order</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select a workpiece and enter the desired quantity.
        </p>
      </div>

      {/* Bereich 1: Werkstück-Karten, eine pro Farbe */}
      <div className="grid grid-cols-3 gap-6">
        {inventory.map((item) => (
          <WorkpieceCard
            key={item.id}
            item={item}
            onOrder={handleOrder}
            alreadyReserved={getAlreadyReserved(item.color)}
          />
        ))}
      </div>

      {/* Bereich 2: CSV-Sammelbestellung */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-600 mb-1">
          Batch Order via CSV
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Upload a CSV file with columns:{" "}
          <code className="bg-gray-100 px-1 rounded">color, quantity</code>
        </p>
        <CSVUpload
          onUpload={async () => {
            const [updatedInv, updatedOrders] = await Promise.all([
              api.getInventory(),
              api.getOrders(),
            ]);
            setInventory(updatedInv);
            setOrders(updatedOrders);
          }}
          inventory={inventory}
          reorderConfigs={reorderConfigs}
        />
      </div>
      {/* Bereich 3: Auto-Reorder-Anfragen pro Farbe */}
      <ReorderRequestSection inventory={inventory} />
    </div>
  );
}

// CSVUpload: Bereich 2 - Sammelbestellung per Datei-Upload ──
// Ablauf: Datei auswählen -> handleFile() parst sie clientseitig für eine
// Vorschau -> validateRow() prüft jede Zeile gegen den aktuellen Bestand ->
// Bestätigungs-Modal -> handleConfirm() schickt die Original-Datei ans Backend,
// das jede Zeile serverseitig nochmal (verbindlich) prüft
function CSVUpload({ onUpload, inventory, reorderConfigs }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);

  const colorDots = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    white: "bg-gray-300 border border-gray-300",
  };

  // Zeile validieren gegen aktuellen Bestand
  function validateRow(row) {
    const item = inventory.find((i) => i.color === row.color);
    if (!item)
      return { type: "error", message: `Color "${row.color}" not found` };
    if (row.quantity > item.supplier_stock)
      return {
        type: "error",
        message: `Only ${item.supplier_stock} available`,
      };
    // Warnung nur, wenn eine aktive ReorderConfig für diese Farbe existiert
    const config = reorderConfigs.find(
      (c) => c.color === row.color && c.status === "active",
    );
    if (config) {
      const threshold = config.minimum_stock + config.safety_stock;
      if (item.supplier_stock - row.quantity < threshold) {
        return {
          type: "warning",
          message: `Stock will fall below reorder threshold after order`,
        };
      }
    }
    return null;
  }

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const text = await f.text();
    const lines = text.split("\n").filter((l) => l.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/[,;]/);
      if (parts.length >= 2) {
        const color = parts[0].trim().toLowerCase();
        const quantity = parseInt(parts[1].trim());
        if (color && !isNaN(quantity)) {
          rows.push({ color, quantity });
        }
      }
    }
    setPreview(rows);
  }

  // Schickt die komplette Original-Datei ans Backend (nicht nur die
  // "gültigen" Zeilen aus der Vorschau) - process_csv() dort verarbeitet
  // jede Zeile unabhängig und liefert pro Zeile Erfolg/Fehler zurück
  async function handleConfirm() {
    if (!file) return;
    setLoading(true);

    const result = await api.importCsv(file);
    setResult(result);
    setPreview(null);
    setLoading(false);
    if (result.successful > 0) onUpload();
  }

  function handleCancel() {
    setPreview(null);
    setFile(null);
    setResult(null);
  }

  // Prüfen ob irgendwelche Errors vorhanden sind
  const validations = preview
    ? preview.map((row) => ({
        row,
        validation: validateRow(row),
      }))
    : [];
  const hasErrors = validations.some((v) => v.validation?.type === "error");
  const hasWarnings = validations.some((v) => v.validation?.type === "warning");
  const allErrors = validations.every((v) => v.validation?.type === "error");

  return (
    <div>
      {/* Datei-Auswahl */}
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:border-red-300 transition-colors">
        <span className="text-gray-400 text-sm">Click to upload CSV file</span>
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="hidden"
        />
      </label>

      {/* Ergebnis nach abgeschlossenem Import (Erfolge/Fehler pro Zeile) */}
      {result && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
          <div className="flex gap-4">
            <span className="text-green-600 font-medium">
              ✓ {result.successful} successful
            </span>
            {result.failed > 0 && (
              <span className="text-red-500 font-medium">
                ✗ {result.failed} failed
              </span>
            )}
          </div>
          {result.details
            .filter((d) => d.status === "failed")
            .map((d, i) => (
              <div key={i} className="text-red-400">
                Row {d.row}: {d.reason}
              </div>
            ))}
        </div>
      )}

      {/* Bestätigungs-Modal: Vorschau der geparsten Zeilen + Validierung */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Confirm Order
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Please review your order before placing it.
            </p>

            {/* Bestellübersicht mit Validierung */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
              {preview.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">
                  No valid rows found in CSV
                </p>
              ) : (
                validations.map(({ row, validation }, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Status Icon */}
                        {validation?.type === "error" && (
                          <span className="text-red-500 text-xs">✗</span>
                        )}
                        {validation?.type === "warning" && (
                          <span className="text-amber-500 text-xs">⚠</span>
                        )}
                        {!validation && (
                          <span className="text-green-500 text-xs">✓</span>
                        )}
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${colorDots[row.color] || "bg-gray-400"}`}
                        />
                        <span className="text-sm text-gray-700 capitalize">
                          {row.color}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          validation?.type === "error"
                            ? "text-red-500 line-through"
                            : "text-gray-800"
                        }`}
                      >
                        {row.quantity} pcs.
                      </span>
                    </div>
                    {/* Validierungsmeldung */}
                    {validation && (
                      <div
                        className={`text-xs mt-1 ml-5 ${
                          validation.type === "error"
                            ? "text-red-500"
                            : "text-amber-500"
                        }`}
                      >
                        {validation.message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Zusammenfassung Warnings/Errors */}
            {preview.length === 0 ? (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-xs text-red-500">
                The CSV file contains no valid orders. Please check the format:
                <br />
                <code className="bg-red-100 px-1 rounded mt-1 inline-block">
                  color, quantity
                </code>
              </div>
            ) : allErrors ? (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-xs text-red-500">
                None of the orders can be placed. Please check your CSV file and
                available stock.
              </div>
            ) : hasErrors && hasWarnings ? (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 text-xs text-amber-600">
                Some orders cannot be placed. Valid orders will still be
                processed.
              </div>
            ) : hasErrors ? (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-xs text-red-500">
                Some orders cannot be placed due to insufficient stock.
              </div>
            ) : hasWarnings ? (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 text-xs text-amber-600">
                ⚠ Some orders will cause stock to fall below minimum level. You
                can still proceed.
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4 text-xs text-green-600">
                ✓ All orders are valid and ready to be placed.
              </div>
            )}

            {/* Buttons */}
            {preview.length === 0 || allErrors ? (
              <button
                onClick={handleCancel}
                className="w-full py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Close
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading
                    ? "Ordering..."
                    : hasErrors
                      ? "Order Valid Items"
                      : "Place Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ReorderRequestSection: Bereich 3 - eine ReorderCard pro Farbe
function ReorderRequestSection({ inventory }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.getReorderConfigs().then((data) => {
      setConfigs(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-600 mb-1">
        Auto-Reorder Requests
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Request automatic reordering when your stock falls below a threshold.
        Requests must be approved by the supplier before becoming active.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {inventory.map((item) => (
          <ReorderCard
            key={item.color}
            item={item}
            config={configs.find(
              (c) => c.color === item.color && c.status !== "cancelled",
            )}
            onSaved={load}
          />
        ))}
      </div>
    </div>
  );
}

// Einzelne Karte: zeigt entweder die bestehende Anfrage oder das Bearbeitungsformular,
// je nach editing-State. Ohne bestehende config startet die Karte direkt im Bearbeitungsmodus.
function ReorderCard({ item, config, onSaved }) {
  const [minimumStock, setMinimumStock] = useState(config?.minimum_stock ?? 10);
  const [safetyStock, setSafetyStock] = useState(config?.safety_stock ?? 5);
  const [orderQuantity, setOrderQuantity] = useState(
    config?.order_quantity ?? 20,
  );
  const [editing, setEditing] = useState(!config);
  const [saving, setSaving] = useState(false);

  const statusStyles = {
    pending: { label: "Pending Approval", cls: "bg-orange-50 text-orange-600" },
    active: { label: "Active", cls: "bg-green-50 text-green-700" },
    paused: { label: "Paused", cls: "bg-gray-100 text-gray-500" },
  };

  // Validierung: minimum/safety dürfen 0 sein, order_quantity muss > 0 sein
  // Leere Felder ("") sind ebenfalls ungültig, bis der Nutzer etwas eintippt
  const isValid =
    minimumStock !== "" &&
    parseInt(minimumStock) >= 0 &&
    safetyStock !== "" &&
    parseInt(safetyStock) >= 0 &&
    orderQuantity !== "" &&
    parseInt(orderQuantity) > 0;

  // Verhindert negative Eingaben direkt beim Tippen (analog zu WorkpieceCard)
  function handleNonNegativeChange(setter) {
    return (e) => {
      const val = e.target.value;
      if (val === "") {
        setter("");
      } else {
        setter(Math.max(0, parseInt(val) || 0));
      }
    };
  }

  async function submit() {
    setSaving(true);
    await api.submitReorderRequest({
      color: item.color,
      minimum_stock: parseInt(minimumStock),
      safety_stock: parseInt(safetyStock),
      order_quantity: parseInt(orderQuantity),
    });
    setSaving(false);
    setEditing(false);
    onSaved(); // statt reload() - lädt nur die Configs neu, nicht die ganze Seite
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 capitalize">
          {item.color}
        </span>
        {config && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[config.status]?.cls}`}
          >
            {statusStyles[config.status]?.label}
          </span>
        )}
      </div>

      {!editing && config ? (
        <div>
          <div className="text-xs text-gray-400 mb-2">
            Min {config.minimum_stock} · Safety {config.safety_stock} · Qty{" "}
            {config.order_quantity}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="w-full py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            Edit Request
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div>
            <label className="text-xs text-gray-400">Minimum Stock</label>
            <input
              type="number"
              min="0"
              value={minimumStock}
              onChange={handleNonNegativeChange(setMinimumStock)}
              placeholder="Minimum"
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Safety Stock</label>
            <input
              type="number"
              min="0"
              value={safetyStock}
              onChange={handleNonNegativeChange(setSafetyStock)}
              placeholder="Safety"
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Reorder Quantity</label>
            <input
              type="number"
              min="1"
              value={orderQuantity}
              onChange={handleNonNegativeChange(setOrderQuantity)}
              placeholder="Reorder Qty"
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs"
            />
          </div>

          {!isValid && (
            <div className="text-xs text-red-500">
              Minimum and safety stock must be 0 or greater, reorder quantity
              must be at least 1.
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving || !isValid}
            className="w-full py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      )}
    </div>
  );
}
