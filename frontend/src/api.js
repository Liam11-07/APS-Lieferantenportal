// Zentrale API-Konfiguration
// Alle Anfragen ans Backend laufen hier durch

const BASE_URL = "http://localhost:8000";

// Schützt admin Aktionen (Deliver, Restock, Reorder-Verwaltung,
// Email-Logs löschen) - siehe backend/app/auth.py: verify_admin_key
const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY || "admin-secret-key-123";
const ADMIN_HEADERS = { "X-API-Key": ADMIN_API_KEY };

export const api = {
  // Inventory
  getInventory: async () => {
    const res = await fetch(`${BASE_URL}/inventory/`);
    return res.json();
  },

  // Orders
  getOrders: async () => {
    const res = await fetch(`${BASE_URL}/orders/`);
    return res.json();
  },

  createOrder: async (color, quantity) => {
    const res = await fetch(`${BASE_URL}/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color, quantity }),
    });
    return res.json();
  },

  cancelOrder: async (orderId) => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
      method: "PATCH",
    });
    return res.json();
  },

  getEmailLogs: async () => {
    const res = await fetch(`${BASE_URL}/email-logs/`);
    return res.json();
  },

  getReorderConfigs: async () => {
    const res = await fetch(`${BASE_URL}/reorder/`);
    return res.json();
  },

  submitReorderRequest: async (data) => {
    const res = await fetch(`${BASE_URL}/reorder/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  approveReorder: async (color) => {
    const res = await fetch(`${BASE_URL}/reorder/${color}/approve`, {
      method: "PATCH",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  rejectReorder: async (color) => {
    const res = await fetch(`${BASE_URL}/reorder/${color}/reject`, {
      method: "PATCH",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  pauseReorder: async (color) => {
    const res = await fetch(`${BASE_URL}/reorder/${color}/pause`, {
      method: "PATCH",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  resumeReorder: async (color) => {
    const res = await fetch(`${BASE_URL}/reorder/${color}/resume`, {
      method: "PATCH",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  terminateReorder: async (color) => {
    const res = await fetch(`${BASE_URL}/reorder/${color}/terminate`, {
      method: "PATCH",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  restockInventory: async (color, amount) => {
    const res = await fetch(`${BASE_URL}/inventory/${color}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ADMIN_HEADERS },
      body: JSON.stringify({ amount }),
    });
    return res.json();
  },

  createDelivery: async (orderId) => {
    const res = await fetch(`${BASE_URL}/deliveries/${orderId}`, {
      method: "POST",
      headers: ADMIN_HEADERS,
    });
    return res.json();
  },

  devReset: async (key) => {
    return fetch(`${BASE_URL}/dev/reset`, {
      method: "DELETE",
      headers: { "X-API-Key": key },
    });
  },

  deleteEmailLogs: async (ids) => {
    const res = await fetch(`${BASE_URL}/email-logs/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...ADMIN_HEADERS },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  // Importiert eine CSV-Datei mit Bestellungen (multipart/form-data, kein JSON)
  importCsv: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/import/csv`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
};
