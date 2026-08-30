// Gemeinsamer Farbpunkt, wiederverwendet in OrderHistory.jsx und AdminOrders.jsx
const DOT_COLORS = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  white: "bg-gray-300 border border-gray-300",
};

export default function ColorDot({ color }) {
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[color] || "bg-gray-400"}`}
    />
  );
}
