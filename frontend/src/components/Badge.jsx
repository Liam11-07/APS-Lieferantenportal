// Status-Badge Komponente
// Sowohl für Order.status (open/delivered/cancelled)
// als auch für Order.source (auto/csv/manual/aps)
const styles = {
  open: "bg-orange-50 text-orange-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  auto: "bg-indigo-50 text-indigo-700",
  csv: "bg-purple-50 text-purple-700",
  manual: "bg-gray-100 text-gray-500",
  aps: "bg-blue-50 text-blue-700",
};

export default function Badge({ status }) {
  const style = styles[status?.toLowerCase()] || styles.manual;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
