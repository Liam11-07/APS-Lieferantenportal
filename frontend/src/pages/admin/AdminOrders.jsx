import { useEffect, useState } from "react";
import { api } from "../../api";
import Badge from "../../components/Badge";
import ColorDot from "../../components/ColorDot";

const PAGE_SIZE = 20;

// Seite "All Orders": komplette Bestellliste über alle Quellen (manual/csv/
// auto/aps), inkl. Deliver/Cancel-Aktionen und den offenen Auto-Reorder-
// Anfragen zur Genehmigung ganz oben.

// PendingReorderRequests: Panel für offene ("pending") Reorder-Anfragen
// -> Admin kann sie hier annehmen oder ablehnen
function PendingReorderRequests({ onChanged }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.getReorderConfigs().then((data) => {
      setPending(data.filter((c) => c.status === "pending"));
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function handle(color, action) {
    if (action === "approve") {
      await api.approveReorder(color);
    } else {
      await api.rejectReorder(color);
    }
    load();
    onChanged();
  }

  if (loading || pending.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
      <h2 className="text-sm font-medium text-orange-700 mb-3">
        Pending Auto-Reorder Requests ({pending.length})
      </h2>
      <div className="space-y-2">
        {pending.map((config) => (
          <div
            key={config.id}
            className="flex items-center justify-between bg-white rounded-lg px-3 py-2"
          >
            <span className="text-sm text-gray-700 capitalize">
              {config.color} — Min {config.minimum_stock}, Safety{" "}
              {config.safety_stock}, Qty {config.order_quantity}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handle(config.color, "approve")}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
              >
                Accept
              </button>
              <button
                onClick={() => handle(config.color, "reject")}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hauptkomponente: Bestelltabelle mit Filter, Pagination und Deliver/Cancel
export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [deliveringId, setDeliveringId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [deliverErrors, setDeliverErrors] = useState({});
  const [page, setPage] = useState(1);

  function loadOrders() {
    Promise.all([api.getOrders(), api.getInventory()]).then(([ord, inv]) => {
      setOrders(ord);
      setInventory(inv);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadOrders();
  }, []);

  // Löst die Lieferung einer offenen Bestellung aus; die eigentliche,
  // verbindliche Prüfung auf ausreichenden physischen Bestand läuft
  // serverseitig - deliverErrors zeigt eine eventuelle Ablehnung an
  async function handleDeliver(orderId) {
    setDeliveringId(orderId);
    setDeliverErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    try {
      const result = await api.createDelivery(orderId);
      if (result.detail) {
        setDeliverErrors((prev) => ({
          ...prev,
          [orderId]: result.detail,
        }));
      } else {
        loadOrders();
      }
    } catch {
      setDeliverErrors((prev) => ({
        ...prev,
        [orderId]: "Network error - could not deliver",
      }));
    } finally {
      setDeliveringId(null);
    }
  }

  async function handleCancel(orderId) {
    setCancelingId(orderId);
    try {
      const result = await api.cancelOrder(orderId);
      if (!result.detail) {
        loadOrders();
      }
    } finally {
      setCancelingId(null);
    }
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "delivered", label: "Delivered" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const filteredOrders = orders.filter(
    (o) => filter === "all" || o.status === filter,
  );
  const sourceCounts = ["manual", "csv", "auto", "aps"].map((s) => ({
    source: s,
    count: orders.filter((o) => o.source === s).length,
  }));

  // Paginierung berechnen
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleFilterChange(key) {
    setFilter(key);
    setPage(1);
  }

  // Prüft ob für eine offene Bestellung aktuell genug Bestand da wäre
  // (informativ - die eigentliche verbindliche Prüfung passiert serverseitig bei Deliver)
  function hasInsufficientStock(order) {
    if (order.status !== "open") return false;
    const item = inventory.find((i) => i.color === order.color);
    if (!item) return false;
    return order.quantity > item.supplier_stock;
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">All Orders</h1>
        <p className="text-sm text-gray-400 mt-1">
          View and manage all incoming orders, regardless of channel.
        </p>
      </div>

      {/* Offene Auto-Reorder-Anfragen zur Genehmigung */}
      <PendingReorderRequests onChanged={loadOrders} />

      {/* Bestellungen pro Quelle gezählt */}
      <div className="flex gap-2">
        {sourceCounts.map(({ source, count }) => (
          <div key={source} className="flex-1">
            <Badge status={source} />
            <span className="ml-2 text-sm font-medium text-gray-600">
              {count}
            </span>
          </div>
        ))}
      </div>

      {/* Status-Filter-Tabs (All/Open/Delivered/Cancelled) */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bestelltabelle mit Deliver/Cancel-Aktionen pro offener Zeile */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Color
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Ordered
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Note
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No orders found
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => {
                const insufficient = hasInsufficientStock(order);
                return (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {order.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ColorDot color={order.color} />
                        <span className="text-sm text-gray-700 capitalize">
                          {order.color}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-1.5">
                        {order.quantity}
                        {insufficient && (
                          <span
                            title="Requested quantity exceeds current supplier stock"
                            className="text-amber-500 text-xs"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={order.source} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">
                      {order.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === "open" && (
                        <div className="space-y-1">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleDeliver(order.id)}
                              disabled={
                                deliveringId === order.id ||
                                cancelingId === order.id ||
                                insufficient
                              }
                              title={
                                insufficient
                                  ? "Not enough physical stock to deliver this order"
                                  : undefined
                              }
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                insufficient
                                  ? "bg-gray-100 text-gray-400"
                                  : "bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
                              }`}
                            >
                              {deliveringId === order.id
                                ? "Delivering..."
                                : "Deliver"}
                            </button>
                            <button
                              onClick={() => handleCancel(order.id)}
                              disabled={
                                deliveringId === order.id ||
                                cancelingId === order.id
                              }
                              className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              {cancelingId === order.id
                                ? "Canceling..."
                                : "Cancel"}
                            </button>
                          </div>
                          {insufficient && (
                            <div className="text-xs text-amber-600">
                              Not enough stock — restock or cancel
                            </div>
                          )}
                          {deliverErrors[order.id] && (
                            <div className="text-xs text-red-500 max-w-[160px]">
                              {deliverErrors[order.id]}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of{" "}
              {filteredOrders.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-md text-xs font-medium ${
                    p === currentPage
                      ? "bg-gray-800 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
