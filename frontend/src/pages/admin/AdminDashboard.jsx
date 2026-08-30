import { useEffect, useState } from "react";
import { api } from "../../api";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const SOURCE_COLORS = {
  manual: "#9ca3af",
  csv: "#a855f7",
  auto: "#6366f1",
  aps: "#3b82f6",
};

// Admin-Startseite: Kennzahlen, "Needs Attention"-Liste (kritischer Bestand +
// offene Bestellungen), Verteilung der Bestellquellen als Pie-Chart, und die
// letzten 5 Bestellungen
export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOrders(),
      api.getInventory(),
      api.getReorderConfigs(),
    ]).then(([ord, inv, configs]) => {
      setOrders(ord);
      setInventory(inv);
      setReorderConfigs(configs);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading...
      </div>
    );

  const openOrders = orders.filter((o) => o.status === "open");
  const autoOrders = orders.filter((o) => o.source === "auto").length;

  // "Needs Attention" / "Low Stock": Farben, bei denen der Kundenbestand unter
  // die Reorder-Schwelle (minimum_stock + safety_stock) gefallen ist - matcht
  // 1:1 die Backend-Logik in check_and_reorder() (reorder_service.py)
  const criticalStock = inventory.filter((item) => {
    const config = reorderConfigs.find(
      (c) => c.color === item.color && c.status === "active",
    );
    if (!config) return false;
    const threshold = config.minimum_stock + config.safety_stock;
    return item.customer_stock < threshold;
  });

  const recentOrders = orders.slice(0, 5);

  // Chart-Daten: Anzahl Bestellungen pro Quelle
  const sourceCounts = ["manual", "csv", "auto", "aps"]
    .map((source) => ({
      name: source,
      value: orders.filter((o) => o.source === source).length,
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>

      {/* Kennzahlen-Kacheln */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Orders"
          value={orders.length}
          sub="all sources"
        />
        <StatCard
          label="Open"
          value={openOrders.length}
          sub="pending"
          valueColor={
            openOrders.length > 0 ? "text-orange-600" : "text-gray-900"
          }
        />
        <StatCard
          label="Auto-Reorders"
          value={autoOrders}
          sub="triggered"
          valueColor="text-indigo-600"
        />
        <StatCard
          label="Low Stock"
          value={criticalStock.length}
          sub={`of ${inventory.length} colors`}
          valueColor={
            criticalStock.length > 0 ? "text-red-600" : "text-gray-900"
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Needs Attention Panel: kritischer Bestand + offene Bestellungen */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-1">
          <h2 className="text-sm font-medium text-gray-600 mb-3">
            Needs Attention
          </h2>

          {criticalStock.length === 0 && openOrders.length === 0 ? (
            <p className="text-sm text-gray-400">Everything looks good.</p>
          ) : (
            <div className="space-y-2">
              {criticalStock.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-red-700 capitalize">
                    {item.color} stock low
                  </span>
                  <span className="text-xs font-medium text-red-600">
                    {item.customer_stock} left
                  </span>
                </div>
              ))}
              {openOrders.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-orange-700">
                    Order #{order.id} — {order.quantity}x {order.color}
                  </span>
                  <span className="text-xs font-medium text-orange-600">
                    awaiting delivery
                  </span>
                </div>
              ))}
              {openOrders.length > 3 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{openOrders.length - 3} more open orders
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pie-Chart: Bestellungen nach Quelle (manual/csv/auto/aps) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-2">
          <h2 className="text-sm font-medium text-gray-600 mb-2">
            Orders by Source
          </h2>
          {sourceCounts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No orders yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceCounts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {sourceCounts.map((entry, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  formatter={(value) =>
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
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
                Source
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Status
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
                    <Badge status={order.source} />
                  </td>
                  <td className="px-4 py-2">
                    <Badge status={order.status} />
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
