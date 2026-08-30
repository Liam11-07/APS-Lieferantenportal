import { useEffect, useState } from "react";
import { api } from "../../api";
import StockBar from "../../components/StockBar";

// Seite "Inventory Management": Bestandsübersicht, manuelles Restocken
// und Anzeige der genehmigten Auto-Reorder-Konfiguration pro Farbe - eine InventoryCard pro Farbe.

function InventoryCard({ item, reorderConfig, allInventory, onRestocked }) {
  const hasConfig = reorderConfig && reorderConfig.status !== "cancelled";
  const hasActiveConfig = reorderConfig && reorderConfig.status === "active";

  // reorderThreshold nur bei aktiver Config setzen - wie bei Overview.jsx und AdminDashboard.jsx
  const reorderThreshold = hasActiveConfig
    ? reorderConfig.minimum_stock + reorderConfig.safety_stock
    : null;

  // Gemeinsame Referenzwerte über alle Farben, damit Balken vergleichbar sind
  const maxSupplierStock = Math.max(
    ...allInventory.map((i) => i.supplier_stock),
    1,
  );
  const maxCustomerStock = Math.max(
    ...allInventory.map((i) => i.customer_stock),
    1,
    reorderThreshold || 0,
  );

  const [restockAmount, setRestockAmount] = useState("");
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState(null);
  const [restockSuccess, setRestockSuccess] = useState(false);

  // Erhöht den Lieferantenbestand um restockAmount; Backend lehnt Menge <= 0
  // oder unbekannte Farben ab
  async function handleRestock() {
    if (!restockAmount || parseInt(restockAmount) <= 0) return;
    setRestocking(true);
    setRestockError(null);
    try {
      const result = await api.restockInventory(
        item.color,
        Math.floor(parseFloat(restockAmount)),
      );
      if (result.detail) {
        setRestockError(result.detail);
        return;
      }
      setRestockAmount("");
      setRestockSuccess(true);
      setTimeout(() => setRestockSuccess(false), 2000);
      onRestocked();
    } finally {
      setRestocking(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base font-semibold text-gray-800 capitalize">
          {item.color}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <div className="text-xs text-gray-400 mb-1">Supplier Stock</div>
          <StockBar
            color={item.color}
            stock={item.supplier_stock}
            maxStock={maxSupplierStock}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Customer Stock</div>
          <StockBar
            color={item.color}
            stock={item.customer_stock}
            maxStock={maxCustomerStock}
            reorderThreshold={reorderThreshold}
          />
        </div>
      </div>

      {/* Restock-Formular: Betrag eingeben, Lieferantenbestand erhöhen */}
      <div className="pt-3 border-t border-gray-100 mb-3">
        <div className="text-xs text-gray-400 mb-2">Restock Supplier</div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={restockAmount}
            onChange={(e) => setRestockAmount(e.target.value)}
            placeholder="Amount"
            disabled={restocking}
            className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-50"
          />
          <button
            onClick={handleRestock}
            disabled={
              restocking || !restockAmount || parseInt(restockAmount) <= 0
            }
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              restockSuccess
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-white hover:bg-gray-900"
            }`}
          >
            {restocking ? "Adding..." : restockSuccess ? "✓ Added" : "Restock"}
          </button>
        </div>
        {restockError && (
          <div className="text-xs text-red-500 mt-1">{restockError}</div>
        )}
      </div>

      {/* Anzeige der vom Kunden gestellten Auto-Reorder-Config */}
      <div className="pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-400 mb-2">
          Auto-Reorder Configuration
        </div>
        {!hasConfig ? (
          <p className="text-xs text-gray-400">
            No reorder request submitted by customer yet
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-400">Minimum</div>
              <div className="text-sm font-medium text-gray-700">
                {reorderConfig.minimum_stock}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Safety</div>
              <div className="text-sm font-medium text-gray-700">
                {reorderConfig.safety_stock}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Reorder Qty</div>
              <div className="text-sm font-medium text-gray-700">
                {reorderConfig.order_quantity}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hauptkomponente: lädt Inventory + ReorderConfigs und rendert eine InventoryCard pro Farbe
export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadAll() {
    Promise.all([api.getInventory(), api.getReorderConfigs()]).then(
      ([inv, cfg]) => {
        setInventory(inv);
        setReorderConfigs(cfg);
        setLoading(false);
      },
    );
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Inventory Management
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          View stock levels, restock supplies, and approved reorder
          configurations per color.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {inventory.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            reorderConfig={reorderConfigs.find((c) => c.color === item.color)}
            allInventory={inventory}
            onRestocked={loadAll}
          />
        ))}
      </div>
    </div>
  );
}
