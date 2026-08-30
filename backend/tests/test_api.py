"""
Test-Suite für das Lieferantenportal Backend.

Deckt die komplette Business-Logik ab: Bestellungen, Lieferungen, Backorder-Limit,
CSV-Import, Auto-Reorder-Workflow (inkl. Cancel/Pause/Resume-Kreislauf),
APS-Schnittstelle und System-Reset.

Vor jedem einzelnen Test wird die Datenbank automatisch zurückgesetzt (siehe
Fixture unten), damit Tests sich niemals gegenseitig beeinflussen.
"""

import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.auth import API_KEY, DEV_RESET_KEY, ADMIN_API_KEY

client = TestClient(app)

# Admin Routen (Deliver, Restock, Reorder-Verwaltung, Email-Logs
# löschen) sind jetzt per verify_admin_key geschützt. 
client.headers.update({"X-API-Key": ADMIN_API_KEY})
API_KEY_HEADER = {"X-API-Key": API_KEY}
DEV_RESET_KEY_HEADER = {"X-API-Key": DEV_RESET_KEY}

@pytest.fixture(autouse=True)
def reset_before_each_test():
    """Setzt vor JEDEM Test die Datenbank auf den Startzustand zurück,
    damit Tests sich nicht gegenseitig beeinflussen."""
    client.delete("/dev/reset", headers=DEV_RESET_KEY_HEADER)
    yield


# =============================================================================
# INVENTORY — Grundzustand und Restock
# =============================================================================

def test_initial_inventory_has_three_colors_at_100():
    """Nach einem Reset müssen alle drei Farben bei supplier_stock=100
    und customer_stock=0 stehen."""
    res = client.get("/inventory/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3
    for item in data:
        assert item["supplier_stock"] == 100
        assert item["customer_stock"] == 0


def test_restock_increases_supplier_stock():
    """Ein Restock erhöht ausschliesslich den Lieferantenbestand."""
    client.post("/inventory/red/restock", json={"amount": 50})
    res = client.get("/inventory/")
    red = next(i for i in res.json() if i["color"] == "red")
    assert red["supplier_stock"] == 150


def test_restock_rejects_zero_or_negative():
    """Ein Restock mit 0 oder weniger muss serverseitig abgelehnt werden."""
    res = client.post("/inventory/red/restock", json={"amount": 0})
    assert res.status_code == 400


# =============================================================================
# BESTELLUNGEN — Grundfunktion
# =============================================================================

def test_create_order_success():
    """Eine gültige Bestellung wird mit Status 'open' und source 'manual'
    angelegt."""
    res = client.post("/orders/", json={"color": "red", "quantity": 10})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "open"
    assert data["source"] == "manual"


def test_order_does_not_change_stock_until_delivered():
    """Kernregel: der Bestand ändert sich erst bei der Lieferung,
    nicht bereits beim Anlegen der Bestellung."""
    client.post("/orders/", json={"color": "red", "quantity": 10})
    res = client.get("/inventory/")
    red = next(i for i in res.json() if i["color"] == "red")
    assert red["supplier_stock"] == 100
    assert red["customer_stock"] == 0


def test_create_order_unknown_color_fails():
    """Eine Bestellung mit einer nicht existierenden Farbe wird abgelehnt."""
    res = client.post("/orders/", json={"color": "green", "quantity": 10})
    assert res.status_code == 400


def test_create_order_negative_quantity_rejected_by_schema():
    """Negative Mengen werden bereits durch die Pydantic-Validierung
    abgefangen, bevor eigene Logik läuft."""
    res = client.post("/orders/", json={"color": "red", "quantity": -5})
    assert res.status_code == 422


# =============================================================================
# BACKORDER-LIMIT
# =============================================================================
# Regel: max_orderable = supplier_stock + max(supplier_stock * 0.5, 20)
# Bei supplier_stock=100 also 100 + 50 = 150

def test_order_within_backorder_limit_succeeds():
    """Eine Bestellung innerhalb des Backorder-Limits wird angenommen."""
    res = client.post("/orders/", json={"color": "red", "quantity": 140})
    assert res.status_code == 200


def test_order_exceeding_backorder_limit_fails():
    """Eine Bestellung über dem Backorder-Limit (150) wird abgelehnt."""
    res = client.post("/orders/", json={"color": "red", "quantity": 160})
    assert res.status_code == 400
    assert "backorder" in res.json()["detail"].lower()


def test_backorder_limit_respects_already_open_orders():
    """Das Limit gilt für die SUMME aller offenen Bestellungen, nicht pro
    einzelner Bestellung."""
    client.post("/orders/", json={"color": "red", "quantity": 100})
    # noch 50 übrig (150 - 100), 51 muss scheitern
    res = client.post("/orders/", json={"color": "red", "quantity": 51})
    assert res.status_code == 400
    # 50 muss noch gehen
    res2 = client.post("/orders/", json={"color": "red", "quantity": 50})
    assert res2.status_code == 200


def test_low_stock_still_allows_minimum_backorder_buffer():
    """Auch bei supplier_stock=0 bleibt durch das feste Minimum (20) noch
    ein Bestellspielraum erhalten."""
    client.post("/orders/", json={"color": "red", "quantity": 150})
    order_id = client.get("/orders/").json()[0]["id"]
    client.post(f"/deliveries/{order_id}")  # ausliefern -> supplier_stock sinkt auf 0

    res = client.get("/inventory/")
    red = next(i for i in res.json() if i["color"] == "red")
    assert red["supplier_stock"] >= 0


# =============================================================================
# STORNIERUNG
# =============================================================================

def test_cancel_open_order():
    """Eine offene Bestellung kann storniert werden, Status wechselt auf
    'cancelled'."""
    order = client.post("/orders/", json={"color": "blue", "quantity": 10}).json()
    res = client.patch(f"/orders/{order['id']}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_cancel_does_not_restore_stock_since_none_was_deducted():
    """Da bei der Bestellung nie Bestand abgezogen wurde, wird bei
    Stornierung auch nichts zurückgebucht."""
    client.post("/orders/", json={"color": "blue", "quantity": 10})
    order_id = client.get("/orders/").json()[0]["id"]
    client.patch(f"/orders/{order_id}/cancel")

    res = client.get("/inventory/")
    blue = next(i for i in res.json() if i["color"] == "blue")
    assert blue["supplier_stock"] == 100


def test_cannot_cancel_already_delivered_order():
    """Eine bereits gelieferte Bestellung kann nicht mehr storniert werden."""
    order = client.post("/orders/", json={"color": "blue", "quantity": 10}).json()
    client.post(f"/deliveries/{order['id']}")
    res = client.patch(f"/orders/{order['id']}/cancel")
    assert res.status_code == 400


# =============================================================================
# LIEFERUNG
# =============================================================================

def test_delivery_moves_stock_correctly():
    """Erst bei der Lieferung sinkt der Lieferantenbestand und steigt der
    Kundenbestand."""
    order = client.post("/orders/", json={"color": "white", "quantity": 20}).json()
    res = client.post(f"/deliveries/{order['id']}")
    assert res.status_code == 200

    inv = next(i for i in client.get("/inventory/").json() if i["color"] == "white")
    assert inv["supplier_stock"] == 80
    assert inv["customer_stock"] == 20


def test_delivery_fails_if_not_enough_physical_stock():
    """Backorder erlaubt eine Bestellung über dem physischen Bestand -
    die Lieferung selbst muss dann trotzdem serverseitig verweigert werden."""
    order = client.post("/orders/", json={"color": "white", "quantity": 140}).json()
    client.post("/inventory/white/restock", json={"amount": 0})  # supplier_stock bleibt 100
    res = client.post(f"/deliveries/{order['id']}")
    assert res.status_code == 400
    assert "not enough physical stock" in res.json()["detail"].lower()


def test_cannot_deliver_same_order_twice():
    """Eine bereits gelieferte Bestellung kann nicht ein zweites Mal
    geliefert werden."""
    order = client.post("/orders/", json={"color": "white", "quantity": 10}).json()
    client.post(f"/deliveries/{order['id']}")
    res = client.post(f"/deliveries/{order['id']}")
    assert res.status_code == 400


# =============================================================================
# CSV-IMPORT
# =============================================================================

def test_csv_import_valid_rows():
    """Alle gültigen Zeilen einer CSV werden erfolgreich als Bestellungen
    angelegt."""
    csv_content = b"color,quantity\nred,10\nblue,5\n"
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["successful"] == 2
    assert data["failed"] == 0


def test_csv_import_mixed_valid_invalid():
    """Schlägt eine Zeile fehl, werden die übrigen gültigen Zeilen
    trotzdem verarbeitet."""
    csv_content = b"color,quantity\nred,10\nred,99999\n"
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    data = res.json()
    assert data["successful"] == 1
    assert data["failed"] == 1


def test_csv_import_rejects_non_csv_file():
    """Nicht-CSV-Dateien werden direkt abgelehnt, bevor der Inhalt
    geparst wird."""
    res = client.post(
        "/import/csv",
        files={"file": ("test.txt", b"not a csv", "text/plain")}
    )
    assert res.status_code == 400


def test_csv_import_with_duplicate_color_rows():
    """Zwei Zeilen mit derselben Farbe in einer CSV - jede Zeile muss
    unabhängig gegen den zu diesem Zeitpunkt aktuellen DB-Stand geprüft
    werden (nicht nur gegen den Ausgangszustand vor dem Import)."""
    csv_content = b"color,quantity\nred,80\nred,80\n"
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    assert res.status_code == 200
    data = res.json()
    # supplier_stock=100, backorder_limit=150 -> erste Zeile (80) geht durch,
    # zweite Zeile würde die Summe (160) über das Limit (150) bringen
    assert data["successful"] == 1
    assert data["failed"] == 1


def test_csv_import_handles_undetectable_delimiter():
    """Eine CSV ohne erkennbares Trennzeichen (nur eine Spalte) darf die
    Anfrage nicht mit einem 500er abstürzen lassen - der Sniffer-Fallback
    auf csv.excel (Komma) greift, und die Zeile scheitert danach sauber
    an der fehlenden 'quantity'-Spalte statt am Parsing selbst."""
    csv_content = b"color\nred\nblue\n"  # keine erkennbare Trennung, keine quantity-Spalte
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    assert res.status_code == 200  # kein Absturz, sauberes JSON-Ergebnis
    data = res.json()
    assert data["successful"] == 0
    assert data["failed"] == 2
    assert "quantity" in data["details"][0]["reason"].lower()


def test_csv_import_handles_empty_file_gracefully():
    """Eine komplett leere Datei darf ebenfalls keinen Absturz verursachen,
    sondern muss sauber mit 0 erfolgreichen und 0 fehlgeschlagenen Zeilen
    zurückkommen."""
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", b"", "text/csv")}
    )
    # Body-Leere wird schon vorher in der Route abgefangen (File is empty),
    # daher hier ein expliziter 400 statt eines Crashs erwartet
    assert res.status_code == 400


def test_csv_import_handles_header_only_no_delimiter():
    """Eine Datei die nur eine Kopfzeile ohne Trennzeichen und ohne
    Datenzeilen enthält, muss ebenfalls sauber mit leeren Ergebnissen
    durchlaufen, nicht abstürzen."""
    csv_content = b"colorquantity\n"  # ein einzelnes, nicht trennbares Wort als Header
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", csv_content, "text/csv")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["successful"] == 0
    assert data["total"] == 0  # keine Datenzeilen vorhanden


def test_csv_import_handles_undecodable_binary_content():
    """Eine Datei mit ungültigen Bytes (z.B. ein umbenanntes Binärformat
    mit .csv-Endung) darf nicht mit einem 500er abstürzen, sondern muss
    sauber mit einer Fehlermeldung zurückkommen."""
    invalid_bytes = b"\xff\xfe\x00\x01\x02invalid binary data \xfa\xfb"
    res = client.post(
        "/import/csv",
        files={"file": ("test.csv", invalid_bytes, "text/csv")}
    )
    assert res.status_code == 200  # kein Absturz
    data = res.json()
    assert data["successful"] == 0
    assert "error" in data


# =============================================================================
# AUTO-REORDER — Grundfunktionen (Antrag, Genehmigung, Ablehnung, Beendigung)
# =============================================================================

def test_reorder_request_starts_as_pending():
    """Ein neuer Reorder-Antrag steht immer zunächst auf 'pending', bis
    der Admin ihn genehmigt."""
    res = client.post("/reorder/", json={
        "color": "red", "minimum_stock": 20, "safety_stock": 5, "order_quantity": 15
    })
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


def test_approve_activates_and_triggers_immediate_check():
    """Genehmigung setzt den Status auf 'active' UND prüft sofort, ob der
    aktuelle Bestand bereits unter der Schwelle liegt (statt erst bei der
    nächsten Lieferung zu reagieren)."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 20, "safety_stock": 5, "order_quantity": 15
    })
    res = client.patch("/reorder/red/approve")
    assert res.status_code == 200
    assert res.json()["status"] == "active"

    orders = client.get("/orders/").json()
    auto_orders = [o for o in orders if o["source"] == "auto"]
    assert len(auto_orders) == 1
    assert auto_orders[0]["quantity"] == 15


def test_reject_pending_request():
    """Eine abgelehnte Anfrage wechselt auf 'cancelled', der Kunde kann
    später erneut beantragen."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 10, "safety_stock": 5, "order_quantity": 10
    })
    res = client.patch("/reorder/red/reject")
    assert res.json()["status"] == "cancelled"


def test_terminate_removes_config_from_active_list():
    """Ein beendeter Dauerauftrag wechselt auf 'cancelled', der Kunde
    müsste für eine erneute Automatik neu beantragen."""
    client.post("/reorder/", json={
        "color": "white", "minimum_stock": 10, "safety_stock": 5, "order_quantity": 10
    })
    client.patch("/reorder/white/approve")
    client.patch("/reorder/white/terminate")

    configs = client.get("/reorder/").json()
    white_config = next(c for c in configs if c["color"] == "white")
    assert white_config["status"] == "cancelled"


def test_terminate_does_not_auto_cancel_open_orders():
    """Wird eine Reorder-Config komplett beendet, bleiben davor bereits
    erzeugte offene Auto-Bestellungen bewusst unangetastet - der Admin
    entscheidet separat, ob er sie noch liefert oder storniert."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 30, "safety_stock": 5, "order_quantity": 10
    })
    client.patch("/reorder/red/approve")

    auto_order = next(o for o in client.get("/orders/").json() if o["source"] == "auto")

    client.patch("/reorder/red/terminate")

    order_after = client.get(f"/orders/{auto_order['id']}").json()
    assert order_after["status"] == "open"


# =============================================================================
# AUTO-REORDER — Nachbestellung nur bei Lieferung, nicht bei Bestellung
# =============================================================================

def test_paused_reorder_does_not_trigger_on_delivery():
    """Eine pausierte Konfiguration darf auch dann keine Nachbestellung
    auslösen, wenn eine Lieferung den Bestand unter die Schwelle drückt."""
    client.post(
        "/api/aps/stock-update",
        json={"color": "blue", "current_stock": 100},
        headers=API_KEY_HEADER
    )

    client.post("/reorder/", json={
        "color": "blue", "minimum_stock": 50, "safety_stock": 10, "order_quantity": 20
    })
    client.patch("/reorder/blue/approve")   # customer_stock=100 > 60 -> löst NICHTS aus
    client.patch("/reorder/blue/pause")     # -> paused

    # Jetzt Bestand unter die Schwelle drücken, während PAUSIERT ist
    order = client.post("/orders/", json={"color": "blue", "quantity": 90}).json()
    client.post(f"/deliveries/{order['id']}")

    orders = client.get("/orders/").json()
    auto_orders = [o for o in orders if o["source"] == "auto"]
    assert len(auto_orders) == 0


# =============================================================================
# AUTO-REORDER — Cancel/Pause/Resume-Kreislauf
# =============================================================================

def test_cancelling_auto_order_pauses_reorder_config():
    """Storniert der Admin eine automatisch erzeugte Bestellung, muss die
    zugehörige Reorder-Config automatisch pausiert werden - sonst würde
    sofort wieder dieselbe Auto-Bestellung entstehen."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 50, "safety_stock": 10, "order_quantity": 20
    })
    client.patch("/reorder/red/approve")  # customer_stock=0 < 60 -> löst sofort aus

    orders = client.get("/orders/").json()
    auto_order = next(o for o in orders if o["source"] == "auto")

    client.patch(f"/orders/{auto_order['id']}/cancel")

    configs = client.get("/reorder/").json()
    red_config = next(c for c in configs if c["color"] == "red")
    assert red_config["status"] == "paused"


def test_cancelling_manual_order_does_not_affect_reorder_config():
    """Storniert der Kunde eine ganz normale manuelle Bestellung, darf sich
    daran nichts an einer bestehenden Reorder-Config ändern."""
    client.post("/reorder/", json={
        "color": "blue", "minimum_stock": 5, "safety_stock": 5, "order_quantity": 10
    })
    client.patch("/reorder/blue/approve")

    manual_order = client.post("/orders/", json={"color": "blue", "quantity": 5}).json()
    client.patch(f"/orders/{manual_order['id']}/cancel")

    configs = client.get("/reorder/").json()
    blue_config = next(c for c in configs if c["color"] == "blue")
    assert blue_config["status"] == "active"


def test_resume_triggers_immediate_reorder_check_if_still_below_threshold():
    """Wird eine pausierte Config wieder auf 'Resume' gesetzt, muss sofort
    geprüft werden ob der Bestand noch immer unter der Schwelle liegt -
    nicht erst bei der nächsten Lieferung."""
    client.post("/reorder/", json={
        "color": "white", "minimum_stock": 30, "safety_stock": 5, "order_quantity": 15
    })
    client.patch("/reorder/white/approve")

    auto_order = next(o for o in client.get("/orders/").json() if o["source"] == "auto")
    client.patch(f"/orders/{auto_order['id']}/cancel")  # -> Config wird "paused"

    res = client.patch("/reorder/white/resume")
    assert res.json()["status"] == "active"

    orders = client.get("/orders/").json()
    auto_orders = [o for o in orders if o["source"] == "auto" and o["status"] == "open"]
    assert len(auto_orders) == 1


def test_pausing_active_config_does_not_trigger_reorder():
    """Das reine Pausieren (nicht Resume) darf selbst keine neue
    Nachbestellung auslösen, unabhängig vom aktuellen Bestand."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 5, "safety_stock": 5, "order_quantity": 10
    })
    client.patch("/reorder/red/approve")

    for o in client.get("/orders/").json():
        if o["source"] == "auto" and o["status"] == "open":
            client.post(f"/deliveries/{o['id']}")

    orders_before = len(client.get("/orders/").json())
    client.patch("/reorder/red/pause")
    orders_after = len(client.get("/orders/").json())

    assert orders_before == orders_after


def test_double_pause_resume_does_not_create_duplicate_orders():
    """Schnelles doppeltes Umschalten (Resume -> Pause -> Resume) darf durch
    die vorhandene Duplikatprüfung in check_and_reorder() keine zwei
    offenen Auto-Bestellungen gleichzeitig erzeugen."""
    client.post("/reorder/", json={
        "color": "white", "minimum_stock": 30, "safety_stock": 5, "order_quantity": 10
    })
    client.patch("/reorder/white/approve")

    auto_order = next(o for o in client.get("/orders/").json() if o["source"] == "auto")
    client.patch(f"/orders/{auto_order['id']}/cancel")  # -> paused

    client.patch("/reorder/white/resume")  # active, sofortiger Trigger
    client.patch("/reorder/white/pause")   # paused
    client.patch("/reorder/white/resume")  # active, erneuter Trigger

    orders = client.get("/orders/").json()
    open_auto_orders = [o for o in orders if o["source"] == "auto" and o["status"] == "open"]
    assert len(open_auto_orders) == 1


def test_full_cycle_approve_cancel_resume():
    """End-to-End Test des kompletten Kreislaufs: genehmigen -> auto-Bestellung
    -> stornieren -> pausiert -> resume -> erneute auto-Bestellung."""
    client.post("/reorder/", json={
        "color": "blue", "minimum_stock": 40, "safety_stock": 10, "order_quantity": 25
    })

    client.patch("/reorder/blue/approve")
    configs = client.get("/reorder/").json()
    assert next(c for c in configs if c["color"] == "blue")["status"] == "active"

    orders = client.get("/orders/").json()
    first_auto = next(o for o in orders if o["source"] == "auto")
    assert first_auto["quantity"] == 25

    client.patch(f"/orders/{first_auto['id']}/cancel")
    configs = client.get("/reorder/").json()
    assert next(c for c in configs if c["color"] == "blue")["status"] == "paused"

    client.patch("/reorder/blue/resume")
    configs = client.get("/reorder/").json()
    assert next(c for c in configs if c["color"] == "blue")["status"] == "active"

    orders = client.get("/orders/").json()
    open_auto_orders = [o for o in orders if o["source"] == "auto" and o["status"] == "open"]
    assert len(open_auto_orders) == 1


def test_cancelling_auto_order_sends_only_one_email():
    """Beim Stornieren einer Auto-Order darf nur die Stornierungsmail
    verschickt werden, nicht zusätzlich eine Reorder-Status-Update-Mail
    für die interne Pausierung."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 50, "safety_stock": 10, "order_quantity": 20
    })
    client.patch("/reorder/red/approve")  # verschickt bereits eine eigene "active"-Statusmail

    auto_order = next(o for o in client.get("/orders/").json() if o["source"] == "auto")

    # Anzahl reorder_status_update-Logs VOR der Stornierung merken (enthält
    # bereits die Mail vom approve oben)
    logs_before = client.get("/email-logs/").json()
    status_update_count_before = len(
        [l for l in logs_before if l["type"] == "reorder_status_update"]
    )

    client.patch(f"/orders/{auto_order['id']}/cancel")

    logs_after = client.get("/email-logs/").json()
    cancellation_logs = [l for l in logs_after if l["type"] == "cancellation_confirmation"]
    status_update_count_after = len(
        [l for l in logs_after if l["type"] == "reorder_status_update"]
    )

    assert len(cancellation_logs) == 1
    # Keine NEUE reorder_status_update-Mail durch die interne Pausierung
    assert status_update_count_after == status_update_count_before


# =============================================================================
# APS-SCHNITTSTELLE — API-Key Pflicht und Kernfunktionen
# =============================================================================

def test_aps_endpoint_without_key_rejected():
    """Ohne gültigen API-Key wird jede Anfrage an /api/aps/* mit 403
    abgelehnt."""
    res = client.post("/api/aps/order", json={"color": "red", "quantity": 5})
    assert res.status_code == 403


def test_aps_endpoint_with_valid_key_succeeds():
    """Mit gültigem API-Key wird eine Bestellung angelegt und automatisch
    mit source 'aps' gekennzeichnet."""
    res = client.post(
        "/api/aps/order",
        json={"color": "red", "quantity": 5},
        headers=API_KEY_HEADER
    )
    assert res.status_code == 200
    assert res.json()["source"] == "aps"


def test_aps_stock_update_changes_customer_stock():
    """Die APS kann über stock-update ihren realen Bestand direkt
    zurückmelden."""
    res = client.post(
        "/api/aps/stock-update",
        json={"color": "red", "current_stock": 42},
        headers=API_KEY_HEADER
    )
    assert res.status_code == 200

    inv = next(i for i in client.get("/inventory/").json() if i["color"] == "red")
    assert inv["customer_stock"] == 42


def test_aps_stock_update_rejects_negative_stock():
    """Die APS darf keinen negativen Bestand melden - das würde die
    Reorder-Schwellenwertprüfung (customer_stock < minimum + safety)
    verfälschen und ist physikalisch unmöglich."""
    res = client.post(
        "/api/aps/stock-update",
        json={"color": "red", "current_stock": -5},
        headers=API_KEY_HEADER
    )
    assert res.status_code == 400


# =============================================================================
# ADMIN-KEY — Schutz der admin-mutierenden Routen (verify_admin_key)
# =============================================================================
# Regressionstest für die Absicherung: vorher waren diese Routen komplett
# offen. WRONG_ADMIN_KEY_HEADER übersteuert pro Aufruf den korrekten
# Default-Header, der oben global auf dem client gesetzt ist.

WRONG_ADMIN_KEY_HEADER = {"X-API-Key": "definitiv-der-falsche-key"}

def test_restock_rejects_wrong_admin_key():
    """Restock ohne gültigen Admin-Key wird abgelehnt, unabhängig davon ob
    Farbe/Menge selbst gültig wären."""
    res = client.post(
        "/inventory/red/restock", json={"amount": 10}, headers=WRONG_ADMIN_KEY_HEADER
    )
    assert res.status_code == 403


def test_deliver_rejects_wrong_admin_key():
    """Lieferung auslösen ohne gültigen Admin-Key wird abgelehnt."""
    order = client.post("/orders/", json={"color": "red", "quantity": 5}).json()
    res = client.post(f"/deliveries/{order['id']}", headers=WRONG_ADMIN_KEY_HEADER)
    assert res.status_code == 403


def test_reorder_approve_rejects_wrong_admin_key():
    """Reorder-Genehmigung ohne gültigen Admin-Key wird abgelehnt."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 10, "safety_stock": 5, "order_quantity": 10
    })
    res = client.patch("/reorder/red/approve", headers=WRONG_ADMIN_KEY_HEADER)
    assert res.status_code == 403


def test_delete_email_logs_rejects_wrong_admin_key():
    """Email-Logs löschen ohne gültigen Admin-Key wird abgelehnt."""
    # DELETE mit Body: TestClient.delete() kennt kein json=-Kwarg,
    # daher über request() wie im Frontend (api.js: deleteEmailLogs)
    res = client.request(
        "DELETE", "/email-logs/", json={"ids": [1]}, headers=WRONG_ADMIN_KEY_HEADER
    )
    assert res.status_code == 403


# =============================================================================
# EMAIL-LOGS
# =============================================================================

def test_get_email_logs_returns_log_after_order():
    """Jede erfolgreiche Bestellung erzeugt einen abrufbaren Email-Log-Eintrag
    (siehe order_service.create_order() -> send_order_confirmation())."""
    client.post("/orders/", json={"color": "red", "quantity": 5})
    logs = client.get("/email-logs/").json()
    assert len(logs) == 1
    assert logs[0]["type"] == "order_confirmation"


def test_delete_email_logs_removes_only_selected_ids():
    """Nur die übergebenen IDs werden gelöscht, andere Logs bleiben erhalten."""
    client.post("/orders/", json={"color": "red", "quantity": 5})
    client.post("/orders/", json={"color": "blue", "quantity": 5})
    logs = client.get("/email-logs/").json()
    assert len(logs) == 2

    res = client.request("DELETE", "/email-logs/", json={"ids": [logs[0]["id"]]})
    assert res.status_code == 200
    assert res.json()["message"] == "1 log(s) deleted"

    remaining = client.get("/email-logs/").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == logs[1]["id"]


# =============================================================================
# WEITERE VALIDIERUNG — Restock, unbekannte Farben, Schema-Validierung
# =============================================================================

def test_restock_rejects_negative_amount():
    """Ein negativer Restock-Betrag muss ebenso abgelehnt werden wie 0
    (restock_inventory() prüft amount <= 0)."""
    res = client.post("/inventory/red/restock", json={"amount": -10})
    assert res.status_code == 400


def test_restock_unknown_color_fails():
    """Restock einer nicht existierenden Farbe wird abgelehnt."""
    res = client.post("/inventory/green/restock", json={"amount": 10})
    assert res.status_code == 400


def test_get_inventory_unknown_color_returns_404():
    """Abfrage einer nicht existierenden Farbe liefert 404, nicht leer/200."""
    res = client.get("/inventory/green")
    assert res.status_code == 404


def test_reorder_actions_on_unknown_color_return_404():
    """approve/reject/terminate für eine Farbe ohne (passende) Reorder-Config
    liefern 404, nicht z.B. einen stillen Erfolg."""
    assert client.patch("/reorder/green/approve").status_code == 404
    assert client.patch("/reorder/green/reject").status_code == 404
    assert client.patch("/reorder/green/terminate").status_code == 404


def test_reorder_create_rejects_zero_quantity_via_schema():
    """order_quantity muss > 0 sein (Field(..., gt=0)) - wird bereits von
    Pydantic abgefangen, bevor der Service läuft."""
    res = client.post("/reorder/", json={
        "color": "red", "minimum_stock": 10, "safety_stock": 5, "order_quantity": 0
    })
    assert res.status_code == 422


# =============================================================================
# RESET
# =============================================================================

def test_reset_clears_orders_and_restores_inventory():
    """Ein Reset löscht alle Bestellungen und setzt den Bestand auf den
    Ausgangszustand zurück."""
    client.post("/orders/", json={"color": "red", "quantity": 10})
    client.delete("/dev/reset", headers=DEV_RESET_KEY_HEADER)

    assert client.get("/orders/").json() == []
    inv = client.get("/inventory/").json()
    for item in inv:
        assert item["supplier_stock"] == 100
        assert item["customer_stock"] == 0


def test_reset_rejects_wrong_dev_key():
    """/dev/reset lehnt einen falschen Key ab, auch wenn es sich (wie hier)
    zufällig um einen gültigen Key für eine ANDERE Route handelt (den
    Admin-Key, der als Default-Header auf diesem Test-Client hinterlegt ist)
    - der destruktivste Endpunkt der API darf keine Ausnahme machen
    (analog zu test_aps_endpoint_without_key_rejected)."""
    res = client.delete("/dev/reset")  # nutzt den Default-Header (Admin-Key), nicht DEV_RESET_KEY_HEADER
    assert res.status_code == 403

# =============================================================================
# UPDATED_AT — automatisches Setzen via onupdate=func.now() (Model-Ebene)
# =============================================================================

def test_inventory_updated_at_changes_automatically_on_restock():
    """Nachdem das manuelle inventory.updated_at = datetime.now() aus dem
    Service entfernt wurde, muss onupdate=func.now() im Model weiterhin
    automatisch einen neuen Zeitstempel setzen, sobald sich der Bestand
    ändert."""
    initial = next(i for i in client.get("/inventory/").json() if i["color"] == "red")
    initial_updated_at = initial["updated_at"]

    time.sleep(1)  # SQLite CURRENT_TIMESTAMP hat Sekunden-Auflösung
    client.post("/inventory/red/restock", json={"amount": 10})

    updated = next(i for i in client.get("/inventory/").json() if i["color"] == "red")
    assert updated["updated_at"] != initial_updated_at


def test_reorder_config_updated_at_changes_on_status_actions():
    """onupdate=func.now() im ReorderConfig-Model muss weiterhin bei jeder
    Status-Änderung (approve, pause) automatisch einen neuen Zeitstempel
    setzen, auch ohne das entfernte manuelle datetime.now()."""
    client.post("/reorder/", json={
        "color": "red", "minimum_stock": 20, "safety_stock": 5, "order_quantity": 10
    })
    config = next(c for c in client.get("/reorder/").json() if c["color"] == "red")
    ts_after_create = config["updated_at"]

    time.sleep(1)
    client.patch("/reorder/red/approve")
    config = next(c for c in client.get("/reorder/").json() if c["color"] == "red")
    ts_after_approve = config["updated_at"]
    assert ts_after_approve != ts_after_create

    time.sleep(1)
    client.patch("/reorder/red/pause")  # -> paused
    config = next(c for c in client.get("/reorder/").json() if c["color"] == "red")
    ts_after_toggle = config["updated_at"]
    assert ts_after_toggle != ts_after_approve