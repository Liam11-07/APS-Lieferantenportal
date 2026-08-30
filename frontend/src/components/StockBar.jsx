// Bestandsbalken mit Farb-Dot
const colorMap = {
  red: { dot: "bg-red-600", bar: "bg-red-500" },
  blue: { dot: "bg-blue-600", bar: "bg-blue-500" },
  white: { dot: "bg-gray-300", bar: "bg-gray-400" },
};

// reorderThreshold = echter Nachbestell-Schwellenwert (minimum_stock + safety_stock
// aus ReorderConfig), falls vorhanden. Damit "isLow" dieselbe Logik nutzt wie
// das Backend (check_and_reorder in reorder_service.py)
export default function StockBar({
  color,
  stock,
  maxStock = 100,
  reorderThreshold = null,
}) {
  const pct = Math.min((stock / maxStock) * 100, 100);
  const colors = colorMap[color] || { dot: "bg-gray-400", bar: "bg-gray-400" };
  const isLow = reorderThreshold !== null ? stock < reorderThreshold : pct < 20;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div
            className={`w-2.5 h-2.5 rounded-full ${colors.dot} border border-gray-200`}
          />
          {color.charAt(0).toUpperCase() + color.slice(1)}
        </div>
        <span
          className={`text-sm font-medium ${isLow ? "text-amber-600" : "text-gray-700"}`}
        >
          {stock} pcs.
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full">
        <div
          className={`h-1.5 rounded-full transition-all ${isLow ? "bg-amber-400" : colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
