import { Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar";

// Layout-Rahmen für das gesamte Kunden-Portal (Overview, Place Order, Order History).
// Zeigt nur Navbar + Hintergrund an - der eigentliche Seiteninhalt kommt über
// <Outlet /> von React Router (siehe App.jsx für die Routen-Zuordnung).
const links = [
  { to: "/", label: "Overview" },
  { to: "/order", label: "Place Order" },
  { to: "/history", label: "Order History" },
];

export default function CustomerLayout() {
  return (
    <div className="min-h-screen bg-[#f0f0ee]">
      <Navbar
        title="Supplier Portal"
        subtitle="fischertechnik APS"
        links={links}
      />
      <main className="max-w-5xl mx-auto p-6">
        {/* Platzhalter von React Router: hier wird je nach aktueller Route
        Overview, PlaceOrder oder OrderHistory eingesetzt */}
        <Outlet />
      </main>
    </div>
  );
}
