from app.models.orders import Order
from app.models.inventory import Inventory
from app.models.deliveries import Delivery
from app.models.reorder_config import ReorderConfig
from app.models.email_log import EmailLog

# SQLAlchemy erstellt beim Start (Base.metadata.create_all() in main.py) nur
# Tabellen für Models, die bereits irgendwo importiert wurden. Fehlt hier ein
# Model, wird seine Tabelle nie angelegt, obwohl die Model-Datei existiert.