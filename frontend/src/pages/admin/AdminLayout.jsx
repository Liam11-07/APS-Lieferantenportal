import { Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar";

// Layout-Rahmen für das gesamte Admin-Portal (Dashboard, Inventory, Orders, System)
// Definiert Navigation und Grundgerüst
const links = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/system", label: "System" },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#e8e8e6]">
      <Navbar
        title="Admin — Supplier Portal"
        subtitle="fischertechnik APS"
        links={links}
        admin={true}
      />
      <main className="max-w-6xl mx-auto p-6">
        {/* Platzhalter von React Router: hier wird die jeweils aktive
        Unterseite eingesetzt (AdminDashboard, AdminInventory, AdminOrders
        oder AdminSystem), je nachdem welcher Link oben gerade aktiv ist -
        AdminLayout selbst ist nur der gemeinsame Rahmen (Navbar + Hintergrund) */}
        <Outlet />
      </main>
    </div>
  );
}
