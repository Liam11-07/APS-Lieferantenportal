import { BrowserRouter, Routes, Route } from "react-router-dom"
import CustomerLayout from "./pages/customer/CustomerLayout"
import AdminLayout from "./pages/admin/AdminLayout"
import Overview from "./pages/customer/Overview"
import PlaceOrder from "./pages/customer/PlaceOrder"
import OrderHistory from "./pages/customer/OrderHistory"
import AdminDashboard from "./pages/admin/AdminDashboard"
import AdminInventory from "./pages/admin/AdminInventory"
import AdminOrders from "./pages/admin/AdminOrders"
import AdminSystem from "./pages/admin/AdminSystem"
import { Link } from "react-router-dom"

// Fängt jede nicht existierende Route ab (Tippfehler in der URL etc.),
// statt dass <Outlet /> einfach leer bleibt
function NotFound() {
  return (
    <div className="min-h-screen bg-[#f0f0ee] flex flex-col items-center justify-center gap-3 text-center px-6">
      <h1 className="text-xl font-semibold text-gray-800">Page not found</h1>
      <p className="text-sm text-gray-400">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-red-600 hover:text-red-700"
      >
        Back to Overview
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Kunden Portal */}
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Overview />} />
          <Route path="order" element={<PlaceOrder />} />
          <Route path="history" element={<OrderHistory />} />
        </Route>

        {/* Admin Portal */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>

        {/* Alles andere - Tippfehler in der URL etc. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}