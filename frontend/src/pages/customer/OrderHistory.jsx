import { useEffect, useState } from "react";
import { api } from "../../api";
import Badge from "../../components/Badge";
import ColorDot from "../../components/ColorDot";

const PAGE_SIZE = 20;

// Seite "Order History": komplette Bestellliste des Kunden mit Status-Filter,
// Stornier-Möglichkeit für offene Bestellungen, und Pagination ab 20 Einträgen
export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [page, setPage] = useState(1);

  function loadOrders() {
    api.getOrders().then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadOrders();
  }, []);

  // Storniert eine offene Bestellung
  async function handleCancel(orderId) {
    setCancelingId(orderId);
    setCancelError(null);
    try {
      const result = await api.cancelOrder(orderId);
      if (result.detail) {
        // Backend lehnt ab (z.B. bereits geliefert) - Fehler sichtbar machen
        // statt die Ablehnung stillschweigend zu ignorieren
        setCancelError(`Order #${orderId}: ${result.detail}`);
      } else {
        loadOrders();
      }
    } catch (e) {
      setCancelError(`Order #${orderId}: ${e.message}`);
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

  const filteredOrders = orders.filter((o) => {
    if (filter === "all") return true;
    return o.status === filter;
  });

  // Paginierung berechnen
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Bei Filterwechsel zurück auf Seite 1
  function handleFilterChange(key) {
    setFilter(key);
    setPage(1);
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
        <h1 className="text-xl font-semibold text-gray-800">Order History</h1>
        <p className="text-sm text-gray-400 mt-1">
          View all your past and current orders.
        </p>
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

      {/* Fehlermeldung bei fehlgeschlagener Stornierung */}
      {cancelError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {cancelError}
        </div>
      )}

      {/* Bestelltabelle mit Cancel-Button pro offener Zeile */}
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
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Ordered
              </th>
              <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">
                Delivered
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
              paginatedOrders.map((order) => (
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
                    {order.quantity}
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
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {order.delivered_at
                      ? new Date(order.delivered_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {order.status === "open" && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelingId === order.id}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {cancelingId === order.id ? "Canceling..." : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls - nur anzeigen wenn mehr als eine Seite existiert */}
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
