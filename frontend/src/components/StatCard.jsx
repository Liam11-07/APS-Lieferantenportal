// Wiederverwendbare Stat-Karte für Dashboard
export default function StatCard({ label, value, sub, valueColor = "text-gray-900" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-300 mt-1">{sub}</div>
    </div>
  )
}