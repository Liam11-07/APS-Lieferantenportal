import paho.mqtt.client as mqtt
import json
import os

# MQTT Client Konfiguration
BROKER_URL = os.getenv("MQTT_BROKER_URL", "localhost")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

def connect_mqtt():
    try:
        # Auth nur setzen, wenn Zugangsdaten vorhanden sind - so bleibt
        # lokales Testen ohne Docker/Auth weiterhin möglich
        if MQTT_USERNAME and MQTT_PASSWORD:
            client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        # connect_async() statt connect(): blockiert nicht und wirft bei
        # sofortigem Fehler keine Exception. Die eigentliche Verbindung
        # (und alle automatischen Reconnect-Versuche bei späterem Erfolg)
        # laufen im Hintergrund-Thread, den loop_start() startet - so bleibt
        # loop_start() auch dann garantiert aktiv, wenn der Broker beim
        # App-Start noch nicht erreichbar ist
        client.connect_async(BROKER_URL, BROKER_PORT)
        client.loop_start()
        print(f"MQTT connecting to {BROKER_URL}:{BROKER_PORT} (async, will retry automatically)")
    except Exception as e:
        print(f"MQTT setup failed: {e}")

def publish(topic: str, payload: dict, qos: int = 1):
    try:
        client.publish(topic, json.dumps(payload), qos=qos)
    except Exception as e:
        print(f"MQTT publish failed on {topic}: {e}")

# Topic-Publisher-Funktionen für die APS-Integration
# Präfix "supplier/" statt "aps/": wir betreiben einen eigenen Broker,
# getrennt vom werksseitigen internen Broker der APS (192.168.0.100:1883).
#
# QoS-Wahl pro Topic (siehe Schnittstellendokument für die volle Begründung):
# - order/created, delivery/completed, reorder/triggered: QoS 1 - alle einmalige Ereignisse 
#   ohne kompensierende Folgenachricht => Verlust nie automatisch nachgeholt
#   Duplikate unproblematisch (Payloads sind reine Fakten, keine "addiere X"-Befehle) 
#   => QoS 2 bringt daher keinen Mehrwert.
# - inventory/updated: QoS 0 - reiner Zustandsausschnitt, wird bei jeder Lieferung/jedem APS-Report 
#   ohnehin erneut verschickt, ein verpasster Zwischenstand ist irrelevant.

def publish_order_created(order_id: int, color: str, quantity: int, source: str):
    publish("supplier/order/created", {
        "order_id": order_id,
        "color": color,
        "quantity": quantity,
        "source": source
    }, qos=1)

def publish_delivery_completed(order_id: int, color: str, quantity: int):
    publish("supplier/delivery/completed", {
        "order_id": order_id,
        "color": color,
        "quantity": quantity
    }, qos=1)

def publish_reorder_triggered(color: str, quantity: int):
    publish("supplier/reorder/triggered", {
        "color": color,
        "quantity": quantity
    }, qos=1)

def publish_inventory_updated(color: str, supplier_stock: int, customer_stock: int):
    publish("supplier/inventory/updated", {
        "color": color,
        "supplier_stock": supplier_stock,
        "customer_stock": customer_stock
    }, qos=0)