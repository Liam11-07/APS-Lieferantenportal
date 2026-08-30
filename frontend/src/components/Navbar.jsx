import { NavLink } from "react-router-dom";

// Navbar Komponente - wird von beiden Portalen genutzt
export default function Navbar({ title, subtitle, links, admin = false }) {
  return (
    <nav
      className={`flex items-center gap-3 px-4 h-12 ${admin ? "bg-[#141412]" : "bg-[#1e1e1c]"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-7 bg-red-600 rounded-sm" />
        <div>
          <div className="text-white text-sm font-medium">{title}</div>
          <div className="text-gray-500 text-xs">{subtitle}</div>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex gap-1 ml-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            // end=true nur für die jeweilige Startseite (/ bzw. /admin), damit
            // sie nicht fälschlich bei JEDEM Unterpfad (z.B. /admin/orders)
            // ebenfalls als "aktiv" markiert wird
            end={link.to === "/admin" || link.to === "/"}
            className={({ isActive }) =>
              `px-3 py-1 rounded text-xs font-medium transition-colors ${
                isActive
                  ? "bg-red-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
