import { useEffect, useState } from "react";
import { api } from "../../api";

// Seite "System": drei Panels, in Render-Reihenfolge; aktive Auto-Reorder-Daueraufträge,
// Email-Logs und Dev-Reset. Jedes Panel lädt seine Daten selbst.

// Panel: Reset System
// Löscht per Klick + Key-Bestätigung alle Bestellungen/Lieferungen/Logs und setzt den Bestand zurück.
function ResetSection({ onReset }) {
  const [confirming, setConfirming] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  function openModal() {
    setKeyInput("");
    setError(null);
    setConfirming(true);
  }

  function closeModal() {
    setConfirming(false);
    setKeyInput("");
    setError(null);
  }

  // Schickt den vom Nutzer eingegebenen Key an /dev/reset; das Backend prüft ihn gegen DEV_RESET_KEY
  async function handleReset() {
    if (!keyInput) {
      setError("Please enter a key");
      return;
    }

    setResetting(true);
    setError(null);

    try {
      const res = await api.devReset(keyInput);

      if (!res.ok) {
        setError(res.status === 403 ? "Invalid key" : "Reset failed");
        setResetting(false);
        return;
      }

      setResetting(false);
      closeModal();
      setDone(true);
      onReset(); // Geschwister-Sektionen (Reorder-Configs, Email-Logs) neu laden lassen
      setTimeout(() => setDone(false), 2500);
    } catch {
      setError("Network error during reset");
      setResetting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-600 mb-1">Reset System</h2>
      <p className="text-xs text-gray-400 mb-4">
        Deletes all orders, deliveries, and email logs. Resets inventory to
        starting values. Intended for development and demo purposes only.
      </p>

      <button
        onClick={openModal}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
      >
        Reset System
      </button>

      {done && (
        <p className="text-sm text-green-600 mt-2">
          ✓ System reset successfully
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-sm font-medium text-gray-800 mb-1">
              Reset System
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              This action cannot be undone. Please enter the Dev-Reset-Key to
              confirm.
            </p>

            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Dev-Reset-Key"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-200"
            />

            {error && <p className="text-xs text-red-600 mb-3">✗ {error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Yes, reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LOGS_PAGE_SIZE = 20;

// Panel: Email Logs
// Zeigt alle bisher versendeten (oder fehlgeschlagenen) System-Emails an.
// Mehrfachauswahl per Checkbox + Bulk-Löschung, mit Pagination ab 20 Einträgen.
function EmailLogsSection() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(false);

  function load() {
    api.getEmailLogs().then((data) => {
      setLogs(data);
      setLoading(false);
      setSelected(new Set());
    });
  }

  useEffect(() => {
    load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = logs.slice(
    (currentPage - 1) * LOGS_PAGE_SIZE,
    currentPage * LOGS_PAGE_SIZE,
  );

  // Einzelnen Log per Checkbox an-/abwählen
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Kopfzeilen-Checkbox: wählt alle Logs der aktuell sichtbaren Seite an/ab
  function toggleSelectAllOnPage() {
    const pageIds = paginatedLogs.map((l) => l.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Löscht alle aktuell ausgewählten Logs unwiderruflich
  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    await api.deleteEmailLogs(Array.from(selected));
    setDeleting(false);
    setPage(1);
    load();
  }

  const allOnPageSelected =
    paginatedLogs.length > 0 && paginatedLogs.every((l) => selected.has(l.id));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-600">Email Logs</h2>
          {selected.size > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {selected.size} selected
            </p>
          )}
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete Selected (${selected.size})`}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 p-5">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400 p-5 text-center">
          No emails sent yet
        </p>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                  Order
                </th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                  Recipient
                </th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-t border-gray-50 ${selected.has(log.id) ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(log.id)}
                      onChange={() => toggleSelect(log.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-400">
                    {log.order_id ? `#${log.order_id}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {log.recipient}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {log.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === "sent"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(log.sent_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                Showing {(currentPage - 1) * LOGS_PAGE_SIZE + 1}–
                {Math.min(currentPage * LOGS_PAGE_SIZE, logs.length)} of{" "}
                {logs.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-md text-xs font-medium ${
                        p === currentPage
                          ? "bg-gray-800 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Panel: Active Auto-Reorder Standing Orders
// Zeigt alle bereits genehmigten Reorder-Konfigurationen (status "active"
// oder "paused") an - pending/cancelled Configs erscheinen hier nicht, siehe
// die genehmigten Anfragen dazu auf der Orders-Seite (PendingReorderRequests).
function ReorderConfigSection() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.getReorderConfigs().then((data) => {
      setConfigs(
        data.filter((c) => c.status === "active" || c.status === "paused"),
      );
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  // Pausiert eine aktive Config bzw. nimmt eine pausierte wieder auf -
  // welche der beiden Backend-Routen aufgerufen wird, hängt vom aktuellen Status ab
  async function togglePauseResume(color, currentStatus) {
    if (currentStatus === "active") {
      await api.pauseReorder(color);
    } else {
      await api.resumeReorder(color);
    }
    load();
  }

  // Beendet den Dauerauftrag endgültig (status -> "cancelled"); der Kunde
  // müsste für eine erneute Automatik komplett neu beantragen
  async function terminate(color) {
    await api.terminateReorder(color);
    load();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-600">
          Active Auto-Reorder Standing Orders
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Pause or permanently end an approved reorder configuration.
        </p>
      </div>

      {configs.length === 0 ? (
        <p className="text-sm text-gray-400 p-5 text-center">
          No active reorder configurations
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Color
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Minimum
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Safety
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Reorder Qty
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id} className="border-t border-gray-50">
                <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                  {config.color}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {config.minimum_stock}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {config.safety_stock}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {config.order_quantity}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      config.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {config.status === "active" ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() =>
                      togglePauseResume(config.color, config.status)
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    {config.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => terminate(config.color)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                  >
                    End
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Hauptkomponente: setzt nur die drei Panels nebeneinander.
// resetCounter wird bei jedem erfolgreichen System-Reset hochgezählt und als
// key an die beiden anderen Panels gegeben - React montiert sie dadurch neu
// und sie laden automatisch frische (leere) Daten, ohne dass ein manueller
// Page-Reload nötig wäre
export default function AdminSystem() {
  const [resetCounter, setResetCounter] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">System</h1>
        <p className="text-sm text-gray-400 mt-1">
          System-level tools, notifications, and automation settings.
        </p>
      </div>

      <ReorderConfigSection key={`reorder-${resetCounter}`} />
      <EmailLogsSection key={`logs-${resetCounter}`} />
      <ResetSection onReset={() => setResetCounter((c) => c + 1)} />
    </div>
  );
}
