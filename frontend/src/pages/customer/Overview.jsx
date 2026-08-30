import { useEffect, useState } from "react";
import { api } from "../../api";
import StatCard from "../../components/StatCard";
import StockBar from "../../components/StockBar";
import Badge from "../../components/Badge";

// Startseite des Kunden-Portals: Kennzahlen, Bestandsübersicht (Lieferant +
// Kunde nebeneinander) und die letzten 5 Bestellungen
export default function Overview() {
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Daten beim Laden der Seite holen
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

  // Ladezustand anzeigen
  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    );
  // Statistiken berechnen
  const openOrders = orders.filter((o) => o.status === "open").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const recentOrders = orders.slice(0, 5);

  // Gemeinsamer Referenzwert pro Bestandsart, damit Balken zwischen den Farben vergleichbar sind
  // (verhindert dass z.B. 100 und 300 gleich "voll" aussehen)
  const maxSupplierStock = Math.max(
    ...inventory.map((i) => i.supplier_stock),
    1,
  );
  const maxCustomerStock = Math.max(
    ...inventory.map((i) => i.customer_stock),
    1,
  );

  // Echten Nachbestell-Schwellenwert pro Farbe ermitteln (minimum_stock + safety_stock),
  // aber NUR wenn die Config wirklich "active" ist
  // gerade nicht nachbestellt
  function getReorderThreshold(color) {
    const config = reorderConfigs.find(
      (c) => c.color === color && c.status === "active",
    );
    return config ? config.minimum_stock + config.safety_stock : null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Overview</h1>

      {/* Kennzahlen-Kacheln: offene/gelieferte Bestellungen, verfügbare Farben */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Open Orders"
          value={openOrders}
          sub="pending"
          valueColor={openOrders > 0 ? "text-orange-600" : "text-gray-900"}
        />
        <StatCard label="Delivered" value={deliveredOrders} sub="total" />
        <StatCard
          label="Available Colors"
          value={inventory.filter((item) => item.supplier_stock > 0).length}
          sub="in stock"
        />
      </div>

      {/* Bestandsbalken: Lieferanten- und Kundenbestand nebeneinander */}
      <div className="grid grid-cols-2 gap-4">
        {/* Supplier Stock */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-600 mb-4">
            Available Stock
          </h2>
          <p className="text-xs text-gray-400 mb-3 -mt-2">
            What the supplier has on hand
          </p>
          {inventory.map((item) => (
            <StockBar
              key={item.id}
              color={item.color}
              stock={item.supplier_stock}
              maxStock={maxSupplierStock}
            />
          ))}
        </div>

        {/* Your Stock */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-600 mb-4">Your Stock</h2>
          <p className="text-xs text-gray-400 mb-3 -mt-2">
            What you currently have on site
          </p>
          {inventory.map((item) => (
            <StockBar
              key={item.id}
              color={item.color}
              stock={item.customer_stock}
              maxStock={maxCustomerStock}
              reorderThreshold={getReorderThreshold(item.color)}
            />
          ))}
        </div>
      </div>

      {/* Letzte 5 Bestellungen */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-600">Recent Orders</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                #
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Color
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Quantity
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No orders yet
                </td>
              </tr>
            ) : (
              recentOrders.map((order) => (
                <tr key={order.id} className="border-t border-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-400">
                    {order.id}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                    {order.color}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {order.quantity}
                  </td>
                  <td className="px-4 py-2">
                    <Badge status={order.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
